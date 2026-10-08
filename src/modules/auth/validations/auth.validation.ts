import { z } from "zod";

/**
 * Client-side validation is a courtesy that saves a round trip; the server
 * validates everything again and its answer counts. These rules are deliberately
 * looser, so a number the server would normalise is never rejected here first.
 */

export const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .email("That doesn't look like an email address");

/**
 * Loose on purpose. The server normalises "07700 900123", "+44 7700 900123" and
 * "(07700) 900123" to one value, so rejecting spacing or brackets here would
 * refuse a number the product accepts. This catches "obviously not a phone".
 */
export const phoneField = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .refine((v) => v.replace(/[^\d]/g, "").length >= 9, "That doesn't look like a mobile number");

export const requestCodesSchema = z.object({
  email: emailField,
  phone: phoneField,
});

export const codeField = z
  .string()
  .trim()
  .min(1, "Enter the code")
  .regex(/^\d+$/, "Codes are numbers only");

/** Both codes — the WhatsApp service is connected and the number is being proved. */
export const verifyBothCodesSchema = z.object({
  emailCode: codeField,
  phoneCode: codeField,
  name: z.string().trim().max(80).optional(),
});

/**
 * The emailed code alone. `phoneCode` stays in the shape so the form has one
 * type in both modes; it is simply never asked for and never sent.
 */
export const verifyEmailCodeSchema = z.object({
  emailCode: codeField,
  phoneCode: z.string().optional(),
  name: z.string().trim().max(80).optional(),
});

export const staffLoginSchema = z.object({
  email: emailField,
  // No length rule at sign-in. Asserting one tells an attacker the policy, and
  // an account created before the policy changed must still be able to get in.
  password: z.string().min(1, "Enter your password"),
});

export type RequestCodesForm = z.infer<typeof requestCodesSchema>;
export type VerifyCodesForm = z.infer<typeof verifyEmailCodeSchema>;
export type StaffLoginForm = z.infer<typeof staffLoginSchema>;
