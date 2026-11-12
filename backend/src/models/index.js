import mongoose from "mongoose";

const { Schema, model } = mongoose;
const base = { timestamps: true, versionKey: false };
const User = model(
  "User",
  new Schema(
    {
      name: String,
      email: { type: String, required: true, unique: true, lowercase: true },
      passwordHash: { type: String, required: true },
      active: { type: Boolean, default: true },
    },
    base,
  ),
);
const Admin = model(
  "AdminUser",
  new Schema(
    {
      email: { type: String, required: true, unique: true, lowercase: true },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ["SUPER_ADMIN"], default: "SUPER_ADMIN" },
      active: { type: Boolean, default: true },
      failedLoginCount: { type: Number, default: 0, min: 0 },
      lockoutUntil: { type: Date, default: null },
    },
    base,
  ),
);
const Wallet = model(
  "Wallet",
  new Schema(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        unique: true,
        required: true,
      },
      currency: { type: String, default: "VE" },
      availableBalance: {
        type: Number,
        min: 0,
        validate: Number.isSafeInteger,
        default: 0,
      },
      reservedBalance: {
        type: Number,
        min: 0,
        validate: Number.isSafeInteger,
        default: 0,
      },
    },
    base,
  ),
);
const Method = model(
  "PayoutMethod",
  new Schema(
    {
      methodKey: {
        type: String,
        enum: ["upi", "amazon", "googlePlay"],
        unique: true,
        required: true,
      },
      displayName: { type: String, required: true },
      description: { type: String, default: "" },
      active: { type: Boolean, default: false },
      maintenanceMessage: { type: String, default: "" },
      sortOrder: { type: Number, default: 0 },
    },
    base,
  ),
);
const Reward = model(
  "RewardOption",
  new Schema(
    {
      rewardId: { type: String, unique: true, required: true },
      method: {
        type: String,
        enum: ["upi", "amazon", "googlePlay"],
        required: true,
      },
      displayName: { type: String, required: true },
      denomination: { type: Number, required: true, min: 0.01 },
      currency: { type: String, default: "INR" },
      requiredVEs: {
        type: Number,
        required: true,
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        validate: Number.isSafeInteger,
      },
      description: { type: String, default: "" },
      assetReference: { type: String, default: "" },
      active: { type: Boolean, default: false },
      sortOrder: { type: Number, default: 0 },
    },
    base,
  ),
);
const Redemption = model(
  "RedemptionRequest",
  new Schema(
    {
      referenceId: { type: String, unique: true, required: true },
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      method: { type: String, required: true },
      rewardOptionId: {
        type: Schema.Types.ObjectId,
        ref: "RewardOption",
        required: true,
      },
      rewardSnapshot: { type: Schema.Types.Mixed, required: true },
      requiredVEs: {
        type: Number,
        required: true,
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        validate: Number.isSafeInteger,
      },
      destination: { type: Schema.Types.Mixed, required: true, select: false },
      status: {
        type: String,
        enum: [
          "PENDING",
          "UNDER_REVIEW",
          "APPROVED",
          "COMPLETED",
          "REJECTED",
          "CANCELLED",
          "FAILED",
        ],
        default: "PENDING",
        index: true,
      },
      providerReference: { type: String, default: "" },
      completedAt: { type: Date, default: null },
      walletTransactionId: Schema.Types.ObjectId,
      idempotencyKey: { type: String, required: true },
      statusHistory: [
        {
          status: String,
          actorId: Schema.Types.ObjectId,
          actorRole: String,
          reason: String,
          at: Date,
        },
      ],
    },
    base,
  )
    .index({ userId: 1, idempotencyKey: 1 }, { unique: true })
    .index({ method: 1, status: 1, createdAt: -1 }),
);
const Ledger = model(
  "WalletTransaction",
  new Schema(
    {
      transactionId: { type: String, unique: true, required: true },
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      currency: { type: String, default: "VE" },
      type: {
        type: String,
        enum: ["REDEMPTION_DEBIT", "REDEMPTION_REVERSAL"],
        required: true,
      },
      amount: {
        type: Number,
        required: true,
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        validate: Number.isSafeInteger,
      },
      balanceBefore: { type: Number, validate: Number.isSafeInteger },
      balanceAfter: { type: Number, validate: Number.isSafeInteger },
      referenceId: { type: String, index: true },
      redemptionRequestId: Schema.Types.ObjectId,
      status: { type: String, default: "POSTED" },
    },
    base,
  ),
);
const Audit = model(
  "AuditLog",
  new Schema(
    {
      actorId: Schema.Types.ObjectId,
      actorRole: String,
      action: String,
      targetId: String,
      reason: String,
      changes: Schema.Types.Mixed,
      at: { type: Date, default: Date.now, index: true },
    },
    { versionKey: false },
  ),
);
const Idempotency = model(
  "IdempotencyRecord",
  new Schema(
    {
      userId: Schema.Types.ObjectId,
      key: String,
      requestHash: { type: String, required: true },
      response: Schema.Types.Mixed,
    },
    { timestamps: true },
  ).index({ userId: 1, key: 1 }, { unique: true }),
);
const Session = model(
  "AdminSession",
  new Schema(
    {
      tokenId: { type: String, unique: true, required: true },
      principalId: { type: Schema.Types.ObjectId, required: true },
      role: { type: String, enum: ["USER", "ADMIN"], required: true },
      expiresAt: { type: Date, required: true },
      revokedAt: Date,
    },
    { timestamps: true },
  ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
);
const PasswordReset = model(
  "PasswordReset",
  new Schema(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
      },
      tokenHash: { type: String, required: true, unique: true },
      expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 },
      },
    },
    { timestamps: true },
  ),
);

export {
  User,
  Admin,
  Wallet,
  Method,
  Reward,
  Redemption,
  Ledger,
  Audit,
  Idempotency,
  Session,
  PasswordReset,
};
