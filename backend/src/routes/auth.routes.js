import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  User,
  Wallet,
  Admin,
  Audit,
  Session,
  PasswordReset,
} from "../models/index.js";
import { auth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { tokenFor } from "../services/sessionService.js";
import { writeAudit } from "../services/auditService.js";
import { validate } from "../validators/index.js";

export function registerAuthRoutes(app) {
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const b = validate(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            email: z.string().email().max(254),
            password: z.string().min(10).max(100),
          })
          .strict(),
        req.body,
      );
      const user = await User.create({
        name: b.name,
        email: b.email,
        passwordHash: await bcrypt.hash(b.password, 12),
      });
      await Wallet.create({ userId: user._id, availableBalance: 0 });
      res.status(201).json({
        token: await tokenFor(user._id, "USER"),
        user: { id: user.id, name: user.name, email: user.email },
      });
    } catch (e) {
      next(
        e.code === 11000
          ? Object.assign(
              new Error("An account with this email already exists."),
              { status: 409, code: "DUPLICATE_ACCOUNT" },
            )
          : e,
      );
    }
  });
  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const b = validate(
        z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .strict(),
        req.body,
      );
      const user = await User.findOne({
        email: b.email.toLowerCase(),
        active: true,
      });
      if (!user || !(await bcrypt.compare(b.password, user.passwordHash)))
        fail(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
      res.json({
        token: await tokenFor(user._id, "USER"),
        user: { id: user.id, name: user.name, email: user.email },
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/forgot-password", async (req, res, next) => {
    try {
      const { email } = validate(
        z.object({ email: z.string().email().max(254) }).strict(),
        req.body,
      );
      const user = await User.findOne({
        email: email.toLowerCase(),
        active: true,
      });
      if (user) {
        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        await PasswordReset.findOneAndUpdate(
          { userId: user._id },
          { tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        const resetUrl = new URL(
          "/reset-password",
          process.env.FRONTEND_URL || "http://localhost:5173",
        );
        resetUrl.searchParams.set("token", rawToken);
        try {
          if (
            process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASSWORD
          ) {
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT) || 587,
              secure: process.env.SMTP_SECURE === "true",
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              },
            });
            await transporter.sendMail({
              from: process.env.MAIL_FROM || process.env.SMTP_USER,
              to: user.email,
              subject: "Reset your VELOOP password",
              text: `Use this link to reset your password. It expires in 30 minutes: ${resetUrl}`,
              html: `<p>We received a request to reset your VELOOP password.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
            });
          } else if (process.env.NODE_ENV !== "production") {
            console.info(
              `Development password reset link for ${user.email}: ${resetUrl}`,
            );
          } else {
            console.error(
              "Password reset email was not sent: SMTP settings are missing.",
            );
          }
        } catch (mailError) {
          console.error(
            "Password reset email could not be sent:",
            mailError.message,
          );
        }
      }
      res.json({
        message:
          "If an account exists for that email, a password reset link has been sent.",
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const b = validate(
        z
          .object({
            token: z.string().length(64),
            password: z.string().min(10).max(100),
          })
          .strict(),
        req.body,
      );
      const tokenHash = createHash("sha256").update(b.token).digest("hex");
      const reset = await PasswordReset.findOne({
        tokenHash,
        expiresAt: { $gt: new Date() },
      });
      if (!reset)
        fail(
          400,
          "This password reset link is invalid or has expired. Request a new link.",
          "INVALID_RESET_TOKEN",
        );
      const passwordHash = await bcrypt.hash(b.password, 12);
      await User.updateOne(
        { _id: reset.userId, active: true },
        { $set: { passwordHash } },
      );
      await PasswordReset.deleteOne({ _id: reset._id });
      await Session.updateMany(
        { principalId: reset.userId, role: "USER", revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      res.json({
        message:
          "Your password has been reset. Sign in with your new password.",
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/admin/auth/login", async (req, res, next) => {
    try {
      const b = validate(
        z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .strict(),
        req.body,
      );
      const admin = await Admin.findOne({
        email: b.email.toLowerCase(),
        active: true,
      });
      if (admin?.lockoutUntil && admin.lockoutUntil > new Date())
        fail(429, "Too many failed sign-in attempts. Try again later.", "ADMIN_ACCOUNT_LOCKED");
      if (
        !admin ||
        admin.role !== "SUPER_ADMIN" ||
        !(await bcrypt.compare(b.password, admin.passwordHash))
      ) {
        if (admin) {
          const failed = await Admin.findOneAndUpdate(
            { _id: admin._id, active: true },
            { $inc: { failedLoginCount: 1 } },
            { new: true },
          );
          if (failed && failed.failedLoginCount >= 8) {
            await Admin.updateOne(
              { _id: failed._id },
              { $set: { lockoutUntil: new Date(Date.now() + 15 * 60 * 1000), failedLoginCount: 0 } },
            );
          }
        }
        await Audit.create({
          action: "ADMIN_LOGIN_FAILED",
          targetId: b.email.toLowerCase(),
          actorRole: "UNKNOWN",
        });
        fail(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
      }
      if (admin.failedLoginCount || admin.lockoutUntil) {
        await Admin.updateOne(
          { _id: admin._id },
          { $set: { failedLoginCount: 0, lockoutUntil: null } },
        );
      }
      await writeAudit(
        { sub: admin._id, role: "ADMIN" },
        "ADMIN_LOGIN",
        admin._id,
      );
      res.json({
        token: await tokenFor(admin._id, "ADMIN"),
        admin: { id: admin.id, email: admin.email, role: admin.role },
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/logout", auth("USER"), async (req, res, next) => {
    try {
      await Session.updateOne(
        { _id: req.actor.sessionId },
        { $set: { revokedAt: new Date() } },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/admin/auth/logout", auth("ADMIN"), async (req, res, next) => {
    try {
      await Session.updateOne(
        { _id: req.actor.sessionId },
        { $set: { revokedAt: new Date() } },
      );
      await writeAudit(req.actor, "ADMIN_LOGOUT", req.actor.sub);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
}
