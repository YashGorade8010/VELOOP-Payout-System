import mongoose from "mongoose";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  Method,
  Redemption,
  Reward,
  Wallet,
  Ledger,
  Idempotency,
} from "../models/index.js";
import { auth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { safeRequest } from "../utils/redemption.js";
import { validate, destinationSchema } from "../validators/index.js";

export function registerRedemptionRoutes(app) {
  const assertValidRewardCost = (reward) => {
    if (!Number.isSafeInteger(reward.requiredVEs) || reward.requiredVEs <= 0)
      fail(500, "Reward VE configuration is invalid.", "INVALID_REWARD_COST");
  };
  const assertValidWallet = (wallet) => {
    if (
      wallet.currency !== "VE" ||
      !Number.isSafeInteger(wallet.availableBalance) ||
      wallet.availableBalance < 0
    )
      fail(500, "Wallet balance or currency is invalid.", "INVALID_WALLET_BALANCE");
  };

  app.post("/api/redemptions/quote", auth(), async (req, res, next) => {
    try {
      const b = validate(
        z
          .object({
            method: z.enum(["upi", "amazon", "googlePlay"]),
            rewardOptionId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid reward option ID."),
          })
          .strict(),
        req.body,
      );
      const [method, reward, wallet] = await Promise.all([
        Method.findOne({ methodKey: b.method, active: true }),
        Reward.findOne({
          _id: b.rewardOptionId,
          method: b.method,
          active: true,
        }),
        Wallet.findOne({ userId: req.actor.sub }),
      ]);
      if (!method)
        fail(
          409,
          "This payout method is currently unavailable.",
          "METHOD_UNAVAILABLE",
        );
      if (!reward)
        fail(
          404,
          "This reward option is no longer available.",
          "OPTION_UNAVAILABLE",
        );
      assertValidRewardCost(reward);
      if (!wallet) fail(404, "Wallet not found.");
      assertValidWallet(wallet);
      res.json({
        reward: {
          id: reward.id,
          displayName: reward.displayName,
          denomination: reward.denomination,
          currency: reward.currency,
          requiredVEs: reward.requiredVEs,
        },
        availableBalance: wallet.availableBalance,
        eligible: wallet.availableBalance >= reward.requiredVEs,
        remainingBalance: Math.max(
          wallet.availableBalance - reward.requiredVEs,
          0,
        ),
        shortfall: Math.max(reward.requiredVEs - wallet.availableBalance, 0),
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/redemptions", auth(), async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
      const b = validate(
        z
          .object({
            method: z.enum(["upi", "amazon", "googlePlay"]),
            rewardOptionId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid reward option ID."),
            destination: z.record(z.string(), z.unknown()),
          })
          .strict(),
        req.body,
      );
      const key = String(req.get("Idempotency-Key") || "").trim();
      if (key.length < 12 || key.length > 128)
        fail(
          400,
          "A valid Idempotency-Key header is required.",
          "IDEMPOTENCY_KEY_REQUIRED",
        );
      const dest = validate(destinationSchema(b.method), b.destination);
      const requestHash = createHash("sha256")
        .update(JSON.stringify({
          method: b.method,
          rewardOptionId: b.rewardOptionId,
          destination: dest,
        }))
        .digest("hex");
      let result;
      await session.withTransaction(async () => {
        const old = await Idempotency.findOne({
          userId: req.actor.sub,
          key,
        }).session(session);
        if (old) {
          if (old.requestHash && old.requestHash !== requestHash)
            fail(
              409,
              "This Idempotency-Key was already used for a different redemption.",
              "IDEMPOTENCY_KEY_REUSED",
            );
          result = old.response;
          return;
        }
        const method = await Method.findOne({
          methodKey: b.method,
          active: true,
        }).session(session);
        const reward = await Reward.findOne({
          _id: b.rewardOptionId,
          method: b.method,
          active: true,
        }).session(session);
        if (!method)
          fail(
            409,
            "This payout method is currently unavailable.",
            "METHOD_UNAVAILABLE",
          );
        if (!reward)
          fail(
            409,
            "This reward option changed or is no longer available. Request a new quote.",
            "OPTION_UNAVAILABLE",
          );
        assertValidRewardCost(reward);
        const wallet = await Wallet.findOneAndUpdate(
          {
            userId: req.actor.sub,
            availableBalance: {
              $gte: reward.requiredVEs,
              $lte: Number.MAX_SAFE_INTEGER,
              $mod: [1, 0],
            },
          },
          { $inc: { availableBalance: -reward.requiredVEs } },
          { new: false, session },
        );
        if (!wallet)
          fail(
            409,
            "Your available VE balance is no longer sufficient. Refresh your wallet and try again.",
            "INSUFFICIENT_BALANCE",
          );
        assertValidWallet(wallet);
        const referenceId = `VLR-${randomBytes(4).toString("hex").toUpperCase()}`;
        const [redemption] = await Redemption.create(
          [
            {
              referenceId,
              userId: req.actor.sub,
              method: b.method,
              rewardOptionId: reward._id,
              rewardSnapshot: {
                displayName: reward.displayName,
                denomination: reward.denomination,
                currency: reward.currency,
                requiredVEs: reward.requiredVEs,
              },
              requiredVEs: reward.requiredVEs,
              destination: dest,
              idempotencyKey: key,
              status: "PENDING",
              statusHistory: [
                {
                  status: "PENDING",
                  actorId: req.actor.sub,
                  actorRole: "USER",
                  reason: "Submitted by user",
                  at: new Date(),
                },
              ],
            },
          ],
          { session },
        );
        const transaction = await Ledger.create(
          [
            {
              transactionId: randomUUID(),
              userId: req.actor.sub,
              currency: wallet.currency,
              type: "REDEMPTION_DEBIT",
              amount: reward.requiredVEs,
              balanceBefore: wallet.availableBalance,
              balanceAfter: wallet.availableBalance - reward.requiredVEs,
              referenceId,
              redemptionRequestId: redemption._id,
            },
          ],
          { session },
        );
        redemption.walletTransactionId = transaction[0]._id;
        await redemption.save({ session });
        result = {
          redemption: {
            referenceId,
            method: redemption.method,
            rewardSnapshot: redemption.rewardSnapshot,
            status: redemption.status,
            submittedAt: redemption.createdAt,
          },
          wallet: {
            availableBalance: wallet.availableBalance - reward.requiredVEs,
          },
        };
        await Idempotency.create(
          [{ userId: req.actor.sub, key, requestHash, response: result }],
          { session },
        );
      });
      res.status(201).json(result);
    } catch (e) {
      next(
        e.code === 11000
          ? Object.assign(
              new Error(
                "This submission was already processed. Refresh your redemption history.",
              ),
              { status: 409, code: "DUPLICATE_SUBMISSION" },
            )
          : e,
      );
    } finally {
      await session.endSession();
    }
  });
  app.get("/api/redemptions/my-history", auth(), async (req, res, next) => {
    try {
      const rows = await Redemption.find({ userId: req.actor.sub })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json({ redemptions: rows.map(safeRequest) });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/redemptions/:referenceId", auth(), async (req, res, next) => {
    try {
      const row = await Redemption.findOne({
        referenceId: req.params.referenceId,
        userId: req.actor.sub,
      }).lean();
      if (!row) fail(404, "Redemption not found.", "NOT_FOUND");
      res.json({ redemption: safeRequest(row) });
    } catch (e) {
      next(e);
    }
  });
}
