# Tier 2 Completion Report: Productization & Scaling

> ⚠️ **Historical / superseded** — predates the current AI-voice architecture (single "Consultorio Completo" plan; reminders/win-backs by outbound Vapi voice call, not WhatsApp). Kept for history. See `CLAUDE.md` → "Current Architecture (AUTHORITATIVE)".

**Objective:** Transform the bespoke, single-clinic architecture into a scalable, secure multi-tenant SaaS platform capable of hosting competing dental clinics on a unified backend.

### 1. Multi-Tenant Architecture & Strict Data Isolation
*   **What was done:** 
    *   We bypassed the unused string-based `clinic_name` column and instead built a normalized, UUID-based tenancy structure via a new `clinics` table and a `clinic_staff` mapping table.
    *   We added the `clinic_id` Foreign Key to both `leads` and `enterprise_leads`.
    *   We enforced strict Row-Level Security (RLS) policies in Postgres ensuring that `auth.users` can *only* `SELECT` or modify rows where the `clinic_id` matches their staff mapping.
    *   We patched the `vapi-webhook` Edge Function to automatically extract the `clinic_id` from the Vapi Assistant's metadata and inject it into the database during the end-of-call report.
*   **Why it was done:** As we scale to Clinic #2 and beyond, deploying separate databases per clinic ("franchise model") creates an unmaintainable codebase. The multi-tenant approach centralizes our code while guaranteeing, at the database level, that competing clinics can absolutely never view each other's leads.

### 2. Dynamic SMS Alert Routing
*   **What was done:** The `vapi-webhook` was modified to prioritize a `clinic_alert_phone` passed inside the Vapi Assistant metadata over the global Supabase environment variable.
*   **Why it was done:** A single environment variable meant every emergency or hot-lead text message would go to the same phone number, regardless of which clinic received the call. This update ensures dynamic, per-tenant SMS routing so the correct closer always gets their clinic's alerts.

### 3. Repeatable Onboarding Runbook
*   **What was done:** Authored `docs/multi_tenant_onboarding_runbook.md`.
*   **Why it was done:** Complex, multi-step provisioning (generating UUIDs, SIP binding Telnyx to Vapi, cloning AI assistants, setting metadata) is highly prone to human error. The runbook standardizes the exact operational procedure to securely spin up a new clinic without missing critical isolation steps.
