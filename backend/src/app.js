import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerPayoutRoutes } from "./routes/payout.routes.js";
import { registerRedemptionRoutes } from "./routes/redemption.routes.js";
import { registerAdminRoutes } from "./routes/admin.routes.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === "production";
const localDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const isConfigured = configuredOrigins.includes(origin);
      const isLocalDevelopment =
        !isProduction && localDevelopmentOrigin.test(origin);
      if (isConfigured || isLocalDevelopment) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "16kb" }));
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(
  "/api/admin/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: "LOGIN_RATE_LIMITED",
        message: "Too many admin sign-in attempts. Try again later.",
      },
    },
  }),
);
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  }),
);
registerAuthRoutes(app);
registerPayoutRoutes(app);
registerRedemptionRoutes(app);
registerAdminRoutes(app);
app.use((req, _res, next) =>
  next(
    Object.assign(new Error("The requested endpoint was not found."), {
      status: 404,
      code: "NOT_FOUND",
    }),
  ),
);
app.use((err, _req, res, _next) => {
  const status =
    Number(err.status) || (err.name === "ValidationError" ? 400 : 500);
  if (status >= 500) console.error("API error", err.message);
  res.status(status).json({
    error: {
      code: err.code || "INTERNAL_ERROR",
      message:
        status >= 500
          ? "The request could not be completed. Please try again."
          : err.message,
    },
  });
});

export { app };
