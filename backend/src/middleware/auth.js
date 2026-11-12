import jwt from "jsonwebtoken";
import { Session } from "../models/index.js";

export function auth(role = "USER") {
  return async (req, _res, next) => {
    try {
      const token = (req.headers.authorization || "").replace(
        /^Bearer\s+/i,
        "",
      );
      if (!token)
        return next(
          Object.assign(new Error("Sign in to continue."), {
            status: 401,
            code: "AUTH_REQUIRED",
          }),
        );
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role !== role)
        return next(
          Object.assign(
            new Error("You are not authorized to perform this action."),
            { status: 403, code: "FORBIDDEN" },
          ),
        );
      const session = await Session.findOne({
        tokenId: payload.sid,
        principalId: payload.sub,
        role,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).lean();
      if (!session)
        return next(
          Object.assign(
            new Error("Your session has been signed out or expired."),
            { status: 401, code: "INVALID_SESSION" },
          ),
        );
      req.actor = { ...payload, sessionId: session._id };
      next();
    } catch (e) {
      next(
        e.name === "JsonWebTokenError" || e.name === "TokenExpiredError"
          ? Object.assign(new Error("Your session is invalid or expired."), {
              status: 401,
              code: "INVALID_SESSION",
            })
          : e,
      );
    }
  };
}
