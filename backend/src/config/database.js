import mongoose from "mongoose";

export function connectDatabase(
  uri = process.env.MONGODB_URI || process.env.MONGO_URI,
) {
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured (legacy MONGO_URI is also supported). Set it in backend/.env.",
    );
  }

  return mongoose
    .connect(uri)
    .then((connection) => {
      console.info("MongoDB connected successfully.");
      return connection;
    })
    .catch((error) => {
      const code = error.code ? ` (code ${error.code})` : "";
      const name = error.name || "MongoDBError";
      if (
        error.code === 8000 ||
        /authentication failed|bad auth/i.test(error.message || "")
      ) {
        console.error(
          "MongoDB authentication failed. Check the database username/password, the database user's authentication method, and URL-encode special characters in credentials. The connection URI was not logged.",
        );
      } else {
        console.error(
          `MongoDB connection failed: ${name}${code}. Check the URI, network access rules, and replica-set availability. The connection URI was not logged.`,
        );
      }
      throw error;
    });
}

export { mongoose };
