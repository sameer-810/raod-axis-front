import type { AuthUser } from "./authSlice";

export interface Session {
  accessToken: string;
  user: AuthUser;
}

export interface CodeChallenge {
  challengeId: string;
  /** True on a first sign-in, which is when the name field is required. */
  isNew: boolean;
  expiresInMinutes: number;
  /**
   * Which codes this sign-in is waiting on. The server decides: two when the
   * WhatsApp service is connected, the emailed one alone when it is not.
   */
  channels: { email: boolean; whatsapp: boolean; sms?: boolean };
  /**
   * How the code to the phone travelled, or null when none was sent. A phone
   * sign-in (D-046) chooses WhatsApp or SMS; the code proving the number on an
   * email or Google sign-in always goes by WhatsApp.
   */
  phoneChannel?: PhoneChannel | null;
  /**
   * Which channels the codes actually reached. The interface names only the ones
   * that worked — telling someone to wait for a message that was never sent is
   * worse than saying nothing.
   */
  delivery: { email: boolean; whatsapp: boolean; sms?: boolean };
  /**
   * Development and CI only. The server refuses to populate this in production
   * regardless of configuration, so a build that shows it there is impossible
   * rather than merely discouraged.
   */
  devCodes?: { email?: string; phone?: string };
}

export type PhoneChannel = "whatsapp" | "sms";
export type SignInMethod = PhoneChannel | "email" | "google";

/**
 * Which ways in this deployment offers right now: connected on the server and
 * not switched off in the console (D-046). `methods` is absent from a server
 * older than D-046, which offered email and, with a client id, Google.
 */
export interface AuthProviders {
  methods?: Record<SignInMethod, boolean>;
  google: { clientId: string } | null;
}

export interface GoogleSignInPayload {
  accessToken: string;
  phone?: string;
  name?: string;
}

/**
 * What "Continue with Google" comes back with: signed in, or the one thing
 * still missing — the WhatsApp number, or the code that proves it.
 */
export type GoogleSignInResult =
  | ({ status: "signed_in" } & Session)
  | { status: "phone_required"; isNew: boolean; email: string; name: string }
  | { status: "code_required"; challenge: CodeChallenge };

/**
 * `whatsapp` / `sms`: a code to the number, and nothing else (D-046).
 * `email`: a code to the address, with the number beside it.
 */
export interface RequestCodesPayload {
  channel: PhoneChannel | "email";
  email?: string;
  phone: string;
}

export interface VerifyCodesPayload {
  challengeId: string;
  /** Absent when Google proved the address and only the WhatsApp code is asked for. */
  emailCode?: string;
  /** Absent when the challenge asked for the emailed code only. */
  phoneCode?: string;
  name?: string;
}
