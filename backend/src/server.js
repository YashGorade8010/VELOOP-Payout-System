import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "./app.js";
import { connectDatabase, mongoose } from "./config/database.js";
import {
  User,
  Admin,
  Wallet,
  Method,
  Reward,
  Redemption,
  Ledger,
  Audit,
  Session,
  PasswordReset,
} from "./models/index.js";

export {
  app,
  mongoose,
  User,
  Admin,
  Wallet,
  Method,
  Reward,
  Redemption,
  Ledger,
  Audit,
  Session,
  PasswordReset,
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const required = ["MONGO_URI", "JWT_SECRET", "CLIENT_ORIGIN"];
  for (const key of required)
    if (!process.env[key])
      console.warn("Missing required environment variable: " + key);
  await connectDatabase();
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => console.log("Payout API listening on port " + port));
}
