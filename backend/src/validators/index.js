import { z } from "zod";
import { fail } from "../utils/errors.js";

export function validate(schema, data) {
  const out = schema.safeParse(data);
  if (!out.success)
    fail(
      400,
      out.error.issues.map((x) => x.message).join(" "),
      "VALIDATION_ERROR",
    );
  return out.data;
}

export function destinationSchema(method) {
  return method === "upi"
    ? z
        .object({
          upiId: z
            .string()
            .trim()
            .min(3)
            .max(100)
            .regex(/^[\w.-]{2,256}@[\w]{2,64}$/, "Enter a valid UPI ID."),
        })
        .strict()
    : z.object({ email: z.string().trim().email().max(254) }).strict();
}
