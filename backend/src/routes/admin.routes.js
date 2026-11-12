import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Method,
  Reward,
  Redemption,
  Ledger,
  Wallet,
  User,
  Audit,
  Session,
} from "../models/index.js";
import { auth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { writeAudit } from "../services/auditService.js";
import { safeRequest } from "../utils/redemption.js";
import { validate } from "../validators/index.js";

export function registerAdminRoutes(app) {
  const isObjectId = (value) => /^[a-f\d]{24}$/i.test(value);
  const dateWindow = (query) => {
    const createdAt = {};
    const parseDate = (value, endOfDay, label) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, `Invalid ${label} date.`);
      const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      )
        fail(400, `Invalid ${label} date.`);
      return date;
    };
    if (query.dateFrom) {
      createdAt.$gte = parseDate(query.dateFrom, false, "start");
    }
    if (query.dateTo) {
      createdAt.$lte = parseDate(query.dateTo, true, "end");
    }
    if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte)
      fail(400, "Start date must be on or before end date.");
    return Object.keys(createdAt).length ? { createdAt } : {};
  };

  app.get("/api/admin/dashboard", auth("ADMIN"), async (req, res, next) => {
    try {
      const range = dateWindow(req.query);
      const ledgerRange = dateWindow({
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      });
      const [counts, totals, debits, payouts, methods, options, recent] = await Promise.all([
        Redemption.aggregate([
          { $match: range },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Redemption.aggregate([
          { $match: range },
          {
            $group: {
              _id: null,
              requestedVEs: { $sum: "$requiredVEs" },
            },
          },
        ]),
        Ledger.aggregate([
          { $match: ledgerRange },
          {
            $group: {
              _id: null,
              netDeductedVEs: {
                $sum: {
                  $cond: [
                    { $eq: ["$type", "REDEMPTION_REVERSAL"] },
                    { $multiply: ["$amount", -1] },
                    "$amount",
                  ],
                },
              },
            },
          },
        ]),
        Redemption.aggregate([
          { $match: range },
          {
            $group: {
              _id: "$rewardSnapshot.currency",
              total: { $sum: "$rewardSnapshot.denomination" },
            },
          },
        ]),
        Method.countDocuments({ active: true }),
        Reward.countDocuments({ active: true }),
        Redemption.find(range).sort({ createdAt: -1 }).limit(8).lean(),
      ]);
      res.json({
        statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
        requestedVEs: totals[0]?.requestedVEs || 0,
        netDeductedVEs: debits[0]?.netDeductedVEs || 0,
        requestedPayoutValues: payouts.map(({ _id, total }) => ({
          currency: _id || "INR",
          total,
        })),
        activeMethods: methods,
        activeOptions: options,
        recent: recent.map(safeRequest),
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/redemptions", auth("ADMIN"), async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1),
        limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const q = dateWindow(req.query);
      if (
        [
          "PENDING",
          "UNDER_REVIEW",
          "APPROVED",
          "COMPLETED",
          "REJECTED",
          "CANCELLED",
          "FAILED",
        ].includes(req.query.status)
      )
        q.status = req.query.status;
      if (["upi", "amazon", "googlePlay"].includes(req.query.method))
        q.method = req.query.method;
      if (req.query.search) {
        const search = String(req.query.search)
          .trim()
          .slice(0, 80)
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (search) {
          const matchingUsers = await User.find({
            $or: [
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          })
            .select("_id")
            .limit(100)
            .lean();
          q.$or = [
            { referenceId: { $regex: search, $options: "i" } },
            { userId: { $in: matchingUsers.map((user) => user._id) } },
          ];
          if (mongoose.Types.ObjectId.isValid(search)) {
            q.$or.push({ userId: new mongoose.Types.ObjectId(search) });
          }
        }
      }
      const [rows, total] = await Promise.all([
        Redemption.find(q)
          .select("-destination")
          .sort(req.query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Redemption.countDocuments(q),
      ]);
      res.json({ redemptions: rows.map(safeRequest), page, limit, total });
    } catch (e) {
      next(e);
    }
  });
  app.get(
    "/api/admin/redemptions/:id",
    auth("ADMIN"),
    async (req, res, next) => {
      try {
        if (!isObjectId(req.params.id)) fail(404, "Redemption not found.");
        const row = await Redemption.findById(req.params.id)
          .select("+destination")
          .lean();
        if (!row) fail(404, "Redemption not found.");
        const transactions = await Ledger.find({
          redemptionRequestId: row._id,
        })
          .sort({ createdAt: 1 })
          .lean();
        res.json({
          redemption: {
            ...safeRequest(row),
            destination: row.destination,
            transactions,
          },
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/admin/redemptions/:id/status",
    auth("ADMIN"),
    async (req, res, next) => {
      const session = await mongoose.startSession();
      try {
        if (!isObjectId(req.params.id)) fail(404, "Redemption not found.");
        const b = validate(
          z
            .object({
              status: z.enum([
                "UNDER_REVIEW",
                "APPROVED",
                "COMPLETED",
                "REJECTED",
                "CANCELLED",
                "FAILED",
              ]),
              reason: z.string().trim().min(3).max(500),
              providerReference: z.string().trim().max(120).optional(),
            })
            .strict(),
          req.body,
        );
        let updated;
        await session.withTransaction(async () => {
          const row = await Redemption.findById(req.params.id).session(session);
          if (!row) fail(404, "Redemption not found.");
          const transitions = {
            PENDING: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
            UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
            APPROVED: ["COMPLETED", "FAILED"],
          };
          if (!transitions[row.status]?.includes(b.status))
            fail(
              409,
              `Cannot change ${row.status} to ${b.status}.`,
              "INVALID_TRANSITION",
            );
          row.status = b.status;
          if (b.status === "COMPLETED") row.completedAt = new Date();
          if (b.providerReference !== undefined) {
            if (b.status !== "COMPLETED")
              fail(400, "Provider references may only be recorded on completion.");
            row.providerReference = b.providerReference;
          }
          row.statusHistory.push({
            status: b.status,
            actorId: req.actor.sub,
            actorRole: "ADMIN",
            reason: b.reason,
            at: new Date(),
          });
          if (["REJECTED", "CANCELLED", "FAILED"].includes(b.status)) {
            const prior = await Ledger.exists({
              redemptionRequestId: row._id,
              type: "REDEMPTION_REVERSAL",
            }).session(session);
            if (!prior) {
              const wallet = await Wallet.findOneAndUpdate(
                {
                  userId: row.userId,
                  availableBalance: {
                    $gte: 0,
                    $lte: Number.MAX_SAFE_INTEGER - row.requiredVEs,
                    $mod: [1, 0],
                  },
                },
                { $inc: { availableBalance: row.requiredVEs } },
                { new: false, session },
              );
              if (!wallet)
                fail(500, "Wallet accounting record is unavailable.");
              if (
                wallet.currency !== "VE" ||
                !Number.isSafeInteger(wallet.availableBalance) ||
                wallet.availableBalance < 0
              )
                fail(500, "Wallet balance or currency is invalid.");
              await Ledger.create(
                [
                  {
                    transactionId: randomUUID(),
                    userId: row.userId,
                    currency: wallet.currency,
                    type: "REDEMPTION_REVERSAL",
                    amount: row.requiredVEs,
                    balanceBefore: wallet.availableBalance,
                    balanceAfter: wallet.availableBalance + row.requiredVEs,
                    referenceId: row.referenceId,
                    redemptionRequestId: row._id,
                  },
                ],
                { session },
              );
            }
          }
          await row.save({ session });
          await Audit.create(
            [
              {
                actorId: req.actor.sub,
                actorRole: "ADMIN",
                action: `REDEMPTION_${b.status}`,
                targetId: row.referenceId,
                reason: b.reason,
                changes: {
                  status: b.status,
                  ...(b.providerReference ? { providerReference: b.providerReference } : {}),
                },
                at: new Date(),
              },
            ],
            { session },
          );
          updated = safeRequest(row);
        });
        res.json({ redemption: updated });
      } catch (e) {
        next(e);
      } finally {
        await session.endSession();
      }
    },
  );
  app.get(
    "/api/admin/payout-methods",
    auth("ADMIN"),
    async (_req, res, next) => {
      try {
        res.json({ methods: await Method.find().sort("sortOrder").lean() });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/admin/payout-methods/:id",
    auth("ADMIN"),
    async (req, res, next) => {
      try {
        if (!isObjectId(req.params.id)) fail(404, "Method not found.");
        const b = validate(
          z
            .object({
              active: z.boolean().optional(),
              displayName: z.string().trim().min(1).max(80).optional(),
              description: z.string().max(500).optional(),
              maintenanceMessage: z.string().max(250).optional(),
              sortOrder: z.number().int().min(0).max(1000).optional(),
              reason: z.string().trim().min(3).max(500).optional(),
            })
            .strict(),
          req.body,
        );
        if (!Object.keys(b).length)
          fail(400, "Provide at least one payout method field.");
        if (b.active !== undefined && !b.reason)
          fail(400, "A reason is required when changing payout method availability.", "REASON_REQUIRED");
        const { reason, ...changes } = b;
        if (!Object.keys(changes).length)
          fail(400, "Provide at least one payout method field.");
        const doc = await Method.findByIdAndUpdate(
          req.params.id,
          { $set: changes },
          { new: true, runValidators: true },
        );
        if (!doc) fail(404, "Method not found.");
        await writeAudit(
          req.actor,
          "PAYOUT_METHOD_UPDATED",
          doc.methodKey,
          reason || "Configuration updated",
          changes,
        );
        res.json({ method: doc });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/reward-options",
    auth("ADMIN"),
    async (_req, res, next) => {
      try {
        res.json({
          options: await Reward.find().sort({ method: 1, sortOrder: 1 }).lean(),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  const rewardInput = z
    .object({
      method: z.enum(["upi", "amazon", "googlePlay"]),
      displayName: z.string().trim().min(1).max(100),
      denomination: z.number().positive().max(100000),
      currency: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/)
        .default("INR"),
      requiredVEs: z.number().int().positive().max(100000000),
      description: z.string().max(500).default(""),
      assetReference: z
        .string()
        .trim()
        .max(200)
        .refine(
          (value) =>
            !value ||
            (value.startsWith("/") && !value.startsWith("//")) ||
            /^https:\/\//i.test(value),
          "Use a site-relative asset path or an HTTPS URL.",
        )
        .default(""),
      active: z.boolean().default(false),
      sortOrder: z.number().int().min(0).max(1000).default(0),
    })
    .strict();
  app.post(
    "/api/admin/reward-options",
    auth("ADMIN"),
    async (req, res, next) => {
      try {
        const b = validate(rewardInput, req.body);
        const doc = await Reward.create({ ...b, rewardId: randomUUID() });
        await writeAudit(
          req.actor,
          "REWARD_OPTION_CREATED",
          doc.rewardId,
          "Reward option created",
          b,
        );
        res.status(201).json({ option: doc });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/admin/reward-options/:id",
    auth("ADMIN"),
    async (req, res, next) => {
      try {
        if (!isObjectId(req.params.id)) fail(404, "Reward option not found.");
        const b = validate(
          rewardInput.partial().extend({
            reason: z.string().trim().min(3).max(500).optional(),
          }),
          req.body,
        );
        if (!Object.keys(b).length) fail(400, "Provide at least one reward option field.");
        if ((b.active !== undefined || b.requiredVEs !== undefined || b.denomination !== undefined) && !b.reason)
          fail(400, "A reason is required when changing reward availability or value.", "REASON_REQUIRED");
        const { reason, ...changes } = b;
        if (!Object.keys(changes).length)
          fail(400, "Provide at least one reward option field.");
        const doc = await Reward.findByIdAndUpdate(
          req.params.id,
          { $set: changes },
          { new: true, runValidators: true },
        );
        if (!doc) fail(404, "Reward option not found.");
        await writeAudit(
          req.actor,
          "REWARD_OPTION_UPDATED",
          doc.rewardId,
          reason || "Reward configuration updated",
          changes,
        );
        res.json({ option: doc });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/admin/users", auth("ADMIN"), async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1),
        limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const q = {};
      if (req.query.search) {
        const search = String(req.query.search)
          .slice(0, 80)
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        q.$or = [
          { email: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ];
        if (mongoose.Types.ObjectId.isValid(search)) {
          q.$or.push({ _id: new mongoose.Types.ObjectId(search) });
        }
      }
      const [users, total] = await Promise.all([
        User.find(q)
          .select("_id name email active createdAt")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        User.countDocuments(q),
      ]);
      const ids = users.map((u) => u._id);
      const [wallets, counts] = await Promise.all([
        Wallet.find({ userId: { $in: ids } })
          .select("userId availableBalance reservedBalance")
          .lean(),
        Redemption.aggregate([
          { $match: { userId: { $in: ids } } },
          { $group: { _id: "$userId", count: { $sum: 1 } } },
        ]),
      ]);
      const walletByUser = new Map(wallets.map((w) => [String(w.userId), w]));
      const countByUser = new Map(counts.map((c) => [String(c._id), c.count]));
      res.json({
        users: users.map((u) => ({
          ...u,
          wallet: walletByUser.get(String(u._id)) || null,
          redemptionCount: countByUser.get(String(u._id)) || 0,
        })),
        page,
        limit,
        total,
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/users/:id", auth("ADMIN"), async (req, res, next) => {
    try {
      if (!isObjectId(req.params.id)) fail(404, "User not found.");
      const [user, wallet, redemptions, transactions] = await Promise.all([
        User.findById(req.params.id)
          .select("_id name email active createdAt")
          .lean(),
        Wallet.findOne({ userId: req.params.id }).lean(),
        Redemption.find({ userId: req.params.id })
          .select("-destination")
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
        Ledger.find({ userId: req.params.id })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
      ]);
      if (!user) fail(404, "User not found.");
      res.json({
        user,
        wallet,
        redemptions: redemptions.map(safeRequest),
        transactions,
      });
    } catch (e) {
      next(e);
    }
  });
  app.patch("/api/admin/users/:id/access", auth("ADMIN"), async (req, res, next) => {
    try {
      if (!isObjectId(req.params.id)) fail(404, "User not found.");
      const body = validate(
        z
          .object({
            active: z.boolean(),
            reason: z.string().trim().min(3).max(500),
          })
          .strict(),
        req.body,
      );
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { active: body.active } },
        { new: true, runValidators: true },
      )
        .select("_id name email active createdAt")
        .lean();
      if (!user) fail(404, "User not found.");
      if (!body.active) {
        await Session.updateMany(
          { principalId: req.params.id, role: "USER", revokedAt: null },
          { $set: { revokedAt: new Date() } },
        );
      }
      await writeAudit(
        req.actor,
        body.active ? "USER_PAYOUT_ACCESS_RESTORED" : "USER_PAYOUT_ACCESS_SUSPENDED",
        String(user._id),
        body.reason,
        { active: body.active },
      );
      res.json({ user });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/transactions", auth("ADMIN"), async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1),
        limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const q = dateWindow(req.query);
      if (["REDEMPTION_DEBIT", "REDEMPTION_REVERSAL"].includes(req.query.type)) q.type = req.query.type;
      if (req.query.userId && isObjectId(String(req.query.userId))) q.userId = req.query.userId;
      if (req.query.referenceId) q.referenceId = String(req.query.referenceId).trim().slice(0, 80);
      const [transactions, total] = await Promise.all([
        Ledger.find(q)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Ledger.countDocuments(q),
      ]);
      res.json({ transactions, page, limit, total });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/audit-logs", auth("ADMIN"), async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1),
        limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
      const window = dateWindow(req.query);
      const q = {};
      if (window.createdAt) q.at = window.createdAt;
      if (req.query.action) q.action = String(req.query.action).trim().slice(0, 100);
      if (req.query.targetId) q.targetId = String(req.query.targetId).trim().slice(0, 120);
      const [logs, total] = await Promise.all([
        Audit.find(q).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Audit.countDocuments(q),
      ]);
      res.json({
        logs,
        page,
        limit,
        total,
      });
    } catch (e) {
      next(e);
    }
  });
}
