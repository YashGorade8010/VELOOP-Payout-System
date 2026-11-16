
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
  const required = ["JWT_SECRET", "CLIENT_ORIGIN"];

  const missing = required.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  const port = Number(process.env.PORT) || 4000;

  // Start API server first
  const server = app.listen(port, () => {
    console.log(`Payout API listening on port ${port}`);

    // Connect to MongoDB after starting the server
    const mongoUri =
      process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      console.error(
        "MongoDB URI is missing. Database features are unavailable."
      );
      return;
    }

    connectDatabase()
      .then(() => {
        console.log("Database connection established.");
      })
      .catch((error) => {
        console.error(
          "MongoDB connection failed:",
          error.message
        );
        console.error(
          "API is running, but database features are unavailable."
        );
      });
  });

  server.on("error", (error) => {
    console.error("Server startup error:", error.message);
    process.exit(1);
  });
}
