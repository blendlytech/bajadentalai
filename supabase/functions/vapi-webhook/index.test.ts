// Tests for vapi-webhook's pure logic.
//
// These import the REAL functions from logic.ts. The previous version of this file
// re-implemented the logic inline ("simulating the logic block from index.ts"), so
// it passed even when index.ts was wrong — it gave false confidence and caught
// nothing. Never assert against a copy of the code under test.
//
// Run: deno test supabase/functions/vapi-webhook/index.test.ts

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  ENT_PROCEDURE,
  REMINDER_STATUS_VALUES,
  baseLanguage,
  baseProcedure,
  inSet,
  parseAppointmentTime,
  parseToolArgs,
  reminderStatusFor,
  resolveClinicId,
  toBool,
  toNum,
} from "./logic.ts";

// --- enum coercion: the guard against losing a lead to a failed insert ---------

Deno.test("baseProcedure maps enterprise-only values onto the leads enum", () => {
  assertEquals(baseProcedure("veneers"), "veneers");
  // Valid for enterprise_leads, NOT a member of procedure_interest_enum.
  assertEquals(baseProcedure("full_mouth_restoration"), "other");
  assertEquals(baseProcedure("unknown"), null);
  assertEquals(baseProcedure(undefined), null);
  assertEquals(baseProcedure(42), null);
});

Deno.test("baseLanguage maps spanglish onto bilingual", () => {
  assertEquals(baseLanguage("english"), "english");
  assertEquals(baseLanguage("spanglish"), "bilingual");
  assertEquals(baseLanguage("klingon"), null);
  assertEquals(baseLanguage(null), null);
});

Deno.test("inSet rejects out-of-range and non-string values", () => {
  assertEquals(inSet(ENT_PROCEDURE, "all_on_4"), "all_on_4");
  assertEquals(inSet(ENT_PROCEDURE, "crowns"), null); // leads-only value
  assertEquals(inSet(ENT_PROCEDURE, 7), null);
});

Deno.test("toBool only accepts true and the string 'true'", () => {
  assertEquals(toBool(true), true);
  assertEquals(toBool("true"), true);
  assertEquals(toBool("yes"), false);
  assertEquals(toBool(1), false);
  assertEquals(toBool(undefined), false);
});

Deno.test("toNum rejects NaN, Infinity and numeric strings", () => {
  assertEquals(toNum(3.5), 3.5);
  assertEquals(toNum("3.5"), null);
  assertEquals(toNum(NaN), null);
  assertEquals(toNum(Infinity), null);
});

// --- reminder status: must never violate the DB CHECK constraint --------------

Deno.test("reminderStatusFor never returns a value the CHECK constraint rejects", () => {
  for (const outcome of ["confirmed", "reschedule", "cancel", "no_answer", "unknown", "", null, 42]) {
    const status = reminderStatusFor(outcome);
    assertEquals(
      REMINDER_STATUS_VALUES.has(status),
      true,
      `reminderStatusFor(${JSON.stringify(outcome)}) returned "${status}", which appointments_reminder_status_check would reject`,
    );
  }
});

Deno.test("reminderStatusFor maps cancel to 'called' (cancellation lives on status)", () => {
  assertEquals(reminderStatusFor("confirmed"), "confirmed");
  assertEquals(reminderStatusFor("reschedule"), "reschedule");
  assertEquals(reminderStatusFor("cancel"), "called");
  assertEquals(reminderStatusFor("no_answer"), "called");
});

// --- tool-call plumbing -------------------------------------------------------

Deno.test("parseToolArgs handles both object and JSON-string arguments", () => {
  assertEquals(parseToolArgs({ patient_name: "Ana" }), { patient_name: "Ana" });
  assertEquals(parseToolArgs('{"patient_name":"Ana"}'), { patient_name: "Ana" });
  assertEquals(parseToolArgs("not json"), {});
  assertEquals(parseToolArgs(undefined), {});
  assertEquals(parseToolArgs("null"), {});
});

Deno.test("parseAppointmentTime refuses to invent a time", () => {
  assertEquals(parseAppointmentTime("2026-08-01T17:00:00Z")?.toISOString(), "2026-08-01T17:00:00.000Z");
  // Must be null, never "now" — defaulting silently books an appointment at call time.
  assertEquals(parseAppointmentTime(undefined), null);
  assertEquals(parseAppointmentTime(""), null);
  assertEquals(parseAppointmentTime("next tuesday-ish"), null);
});

// --- tenant routing: the bug that made bookings invisible to the clinic -------

Deno.test("resolveClinicId reads Vapi's message-nested call object", () => {
  const call = { assistantOverrides: { metadata: { clinic_id: "clinic-a" } } };
  assertEquals(resolveClinicId(call), "clinic-a");
  assertEquals(resolveClinicId({ metadata: { clinic_id: "clinic-b" } }), "clinic-b");
});

Deno.test("resolveClinicId returns null for the WRONG payload level (regression)", () => {
  // Vapi sends { message: { call: {...} } }. Passing the top-level payload — which
  // index.ts used to do in the bookAppointment branch — yields null, producing
  // appointments with clinic_id NULL that no clinic's RLS policy can ever match.
  const payload = { message: { call: { metadata: { clinic_id: "clinic-a" } } } };
  assertEquals(resolveClinicId(payload), null);
  assertEquals(resolveClinicId(payload.message.call), "clinic-a");
});
