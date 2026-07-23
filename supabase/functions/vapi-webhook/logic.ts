// Pure, dependency-free logic for vapi-webhook.
//
// Extracted from index.ts so it can be unit-tested without starting a server or
// touching the database. These functions are where silent data-loss bugs live:
// a wrong coercion here either throws on insert (losing a lead) or writes a value
// the DB CHECK constraint rejects.
//
// index.ts imports from this file; keep them in sync by importing, never copying.

// The live `leads` table and `enterprise_leads` use different, fixed value sets.
// Vapi's structuredData can contain values valid for the enterprise schema but NOT
// for the base `leads` enums (e.g. full_mouth_restoration / unknown / spanglish).
export const LEADS_PROCEDURE = new Set(["veneers", "implants", "whitening", "all_on_4", "crowns", "other"]);
export const LEADS_LANGUAGE = new Set(["english", "spanish", "bilingual"]);

export const ENT_PROCEDURE = new Set(["all_on_4", "veneers", "implants", "full_mouth_restoration", "whitening", "unknown"]);
export const ENT_URGENCY = new Set(["asap", "within_30_days", "within_6_months", "just_browsing"]);
export const ENT_FINANCIAL = new Set(["cash_ready", "needs_financing", "price_shopping", "unknown"]);
export const ENT_LANGUAGE = new Set(["english", "spanish", "spanglish"]);

/** Return `v` only if it is a string present in `set`, else null. */
export const inSet = (set: Set<string>, v: unknown): string | null =>
  typeof v === "string" && set.has(v) ? v : null;

/** Map an enterprise procedure value onto the closest base `leads` enum. */
export function baseProcedure(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (LEADS_PROCEDURE.has(v)) return v;
  if (v === "full_mouth_restoration") return "other";
  return null; // e.g. "unknown"
}

/** Map an enterprise language value onto the closest base `leads` enum. */
export function baseLanguage(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (LEADS_LANGUAGE.has(v)) return v;
  if (v === "spanglish") return "bilingual";
  return null;
}

export const toBool = (v: unknown): boolean => v === true || v === "true";

export const toNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Map a reminder call outcome onto appointments.reminder_status.
 *
 * The return value MUST stay inside appointments_reminder_status_check
 * ('pending','called','confirmed','reschedule','failed','skipped'). A cancellation
 * is recorded on appointments.status, never here — returning 'cancelled' would make
 * the UPDATE throw and the call outcome would be lost.
 */
export function reminderStatusFor(outcome: unknown): "confirmed" | "reschedule" | "called" {
  if (outcome === "confirmed") return "confirmed";
  if (outcome === "reschedule") return "reschedule";
  return "called"; // includes cancel, no_answer, unknown, and non-strings
}

/** Values accepted by the appointments_reminder_status_check constraint. */
export const REMINDER_STATUS_VALUES = new Set([
  "pending", "called", "confirmed", "reschedule", "failed", "skipped",
]);

/** Vapi may send tool-call arguments as a JSON string or an already-parsed object. */
export function parseToolArgs(rawArgs: unknown): Record<string, any> {
  if (typeof rawArgs === "string") {
    try {
      const parsed = JSON.parse(rawArgs);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  if (rawArgs && typeof rawArgs === "object") return rawArgs as Record<string, any>;
  return {};
}

/**
 * Parse a requested appointment time. Returns null when absent or unparseable —
 * callers must NOT fall back to "now", which silently books an appointment at the
 * moment of the call.
 */
export function parseAppointmentTime(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Read the tenant id out of a Vapi call object. Vapi nests the call under
 * `message`, so callers must pass `message.call` — passing the top-level payload
 * yields null and produces appointments no clinic can see.
 */
export function resolveClinicId(callObj: unknown): string | null {
  const c = callObj as Record<string, any> | null | undefined;
  return c?.assistantOverrides?.metadata?.clinic_id ?? c?.metadata?.clinic_id ?? null;
}
