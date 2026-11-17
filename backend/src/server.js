
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

// Export app, database and models
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

// Start server only when this file is executed directly
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  // Validate required environment variables
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

  const PORT = Number(process.env.PORT) || 4000;

  console.log("Starting VELOOP Payout API...");

  // Start Express server
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`VELOOP API listening on port ${PORT}`);

    // Get MongoDB connection URI
    const mongoUri =
      process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      console.error("MongoDB URI is missing.");
      return;
    }

    // Connect to MongoDB
    connectDatabase()
      .then(() => {
        console.log("MongoDB connected successfully.");
      })
      .catch((error) => {
        console.error(
          "MongoDB connection failed:",
          error.name || "MongoDBError",
          error.code || ""
        );

        console.error(
          "API is running, but database features are unavailable."
        );
      });
  });

  // Handle server errors
  server.on("error", (error) => {
    console.error("Server startup error:", error.message);
    process.exit(1);
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log("Shutting down VELOOP API...");

    server.close(async () => {
      try {
        await mongoose.disconnect();
        console.log("MongoDB disconnected.");
      } catch (error) {
        console.error("MongoDB disconnect error:", error.message);
      }

      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
