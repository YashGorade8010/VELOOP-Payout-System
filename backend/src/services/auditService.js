import { Audit } from "../models/index.js";

export async function writeAudit(
  actor,
  action,
  targetId,
  reason = "",
  changes = {},
) {
  await Audit.create({
    actorId: actor.sub,
    actorRole: actor.role,
    action,
    targetId: String(targetId),
    reason,
    changes,
  });
}
