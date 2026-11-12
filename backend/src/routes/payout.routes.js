import { Method, Redemption, Reward, Wallet } from "../models/index.js";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { validate } from "../validators/index.js";

export function registerPayoutRoutes(app) {
  const publicMethods = () =>
    Method.find()
      .select("methodKey displayName description active maintenanceMessage sortOrder")
      .sort("sortOrder")
      .lean();

  app.get("/api/payout/methods", async (_req, res, next) => {
    try {
      res.json({ methods: await publicMethods() });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/payout/config", async (_req, res, next) => {
    try {
      const [methods, options] = await Promise.all([
        publicMethods(),
        Reward.find({ active: true }).sort("sortOrder").lean(),
      ]);
      res.json({ methods, options });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/payout/options", async (req, res, next) => {
    try {
      const b = validate(
        z.object({ method: z.enum(["upi", "amazon", "googlePlay"]) }),
        req.query,
      );
      const method = await Method.findOne({
        methodKey: b.method,
        active: true,
      }).lean();
      if (!method)
        fail(
          404,
          "This payout method is currently unavailable.",
          "METHOD_UNAVAILABLE",
        );
      res.json({
        method,
        options: await Reward.find({ method: b.method, active: true })
          .sort("sortOrder")
          .lean(),
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/wallet", auth(), async (req, res, next) => {
    try {
      const [wallet, completedWithdrawals] = await Promise.all([
        Wallet.findOne({ userId: req.actor.sub }).lean(),
        Redemption.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(req.actor.sub),
              status: "COMPLETED",
              "rewardSnapshot.currency": "INR",
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$rewardSnapshot.denomination" },
            },
          },
        ]),
      ]);
      if (!wallet) fail(404, "Wallet not found.");
      if (
        wallet.currency !== "VE" ||
        !Number.isSafeInteger(wallet.availableBalance) ||
        wallet.availableBalance < 0 ||
        !Number.isSafeInteger(wallet.reservedBalance) ||
        wallet.reservedBalance < 0
      )
        fail(500, "Wallet balance or currency is invalid.", "INVALID_WALLET_BALANCE");
      res.json({
        wallet: {
          currency: wallet.currency,
          availableBalance: wallet.availableBalance,
          reservedBalance: wallet.reservedBalance,
          totalWithdrawn: completedWithdrawals[0]?.total || 0,
        },
      });
    } catch (e) {
      next(e);
    }
  });
}
