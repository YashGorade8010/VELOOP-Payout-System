import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { Session } from "../models/index.js";

export async function tokenFor(id, role) {
  const sid = randomUUID();
  const token = jwt.sign(
    { sub: String(id), role, sid },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "2h" },
  );
  const expiresAt = new Date(jwt.decode(token).exp * 1000);
  await Session.create({ tokenId: sid, principalId: id, role, expiresAt });
  return token;
}
