import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Admin, User, Wallet, Method } from "./models/index.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("The demo seed command is disabled in production.");
}

const adminEmail = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_SEED_PASSWORD;
if (
  !process.env.MONGO_URI ||
  !adminEmail ||
  !adminPassword ||
  adminPassword.length < 12
) {
  throw new Error(
    "Set MONGO_URI, ADMIN_SEED_EMAIL and an ADMIN_SEED_PASSWORD of at least 12 characters before seeding.",
  );
}
await mongoose.connect(process.env.MONGO_URI);
const passwordHash = await bcrypt.hash(adminPassword, 12);
await Admin.updateOne(
  { email: adminEmail },
  {
    $setOnInsert: {
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
      active: true,
    },
  },
  { upsert: true },
);

const userEmail = process.env.USER_SEED_EMAIL?.trim().toLowerCase();
if (userEmail && process.env.USER_SEED_PASSWORD) {
  const userHash = await bcrypt.hash(process.env.USER_SEED_PASSWORD, 12);
  let user = await User.findOne({ email: userEmail });
  if (!user)
    user = await User.create({
      email: userEmail,
      name: "Demo User",
      passwordHash: userHash,
      active: true,
    });
  const demoBalance = Math.max(
    0,
    Math.floor(Number(process.env.DEMO_STARTING_VES) || 0),
  );
  await Wallet.updateOne(
    { userId: user._id },
    {
      $setOnInsert: {
        userId: user._id,
        currency: "VE",
        availableBalance: demoBalance,
        reservedBalance: 0,
      },
    },
    { upsert: true },
  );
}

for (const [methodKey, displayName, description, sortOrder] of [
  [
    "upi",
    "UPI Cash",
    "Cash redemption through supported UPI payout options.",
    1,
  ],
  [
    "amazon",
    "Amazon Gift Card",
    "Amazon gift-card redemption based on active configuration.",
    2,
  ],
  [
    "googlePlay",
    "Google Play Gift Card",
    "Google Play gift-card redemption based on active configuration.",
    3,
  ],
]) {
  await Method.updateOne(
    { methodKey },
    {
      $setOnInsert: {
        methodKey,
        displayName,
        description,
        active: false,
        maintenanceMessage: "Reward configuration pending verification.",
        sortOrder,
      },
    },
    { upsert: true },
  );
}
console.log(
  "Demo admin/user and inactive payout methods are ready. No reward denominations were seeded.",
);
await mongoose.disconnect();
