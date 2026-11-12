import mongoose from "mongoose";

export function connectDatabase(
  uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/veloop_payout",
) {
  return mongoose.connect(uri);
}

export { mongoose };
