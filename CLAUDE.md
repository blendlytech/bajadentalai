# BajaDentalAI - System Instructions & Project Context

## Overview

You are operating as an autonomous AI software engineer. Your task is to build Baja Dental AI, a localized AI booking agent for dental clinics in Mexicali, Mexico. You must adhere to the multi-tenant architecture and strictly follow the guardrails.

## Current Architecture (AUTHORITATIVE — read before proposing changes)

> The build has moved past the original PRD's WhatsApp-text vision below. This section describes what is **actually deployed**. If it conflicts with older docs, this wins.

- **Telephony:** Inbound calls arrive on a **Telnyx** number (`TELNYX_PHONE_NUMBER` in `.env`) routed to the Vapi assistant via a BYO SIP trunk (see `vapi_config/telnyx_sip_setup.sh`).
- **Voice front end:** A Vapi.ai assistant ("Sofía", `VAPI_ASSISTANT_ID` in `.env`) answers inbound calls. Persona lives in `vapi_config/system_prompt.txt`. The structured-data extraction schema lives in `vapi_config/*structured_data_schema*.json` and is set on the assistant under `analysisPlan.structuredDataPlan`.
- **Ingestion:** Vapi POSTs the `end-of-call-report` to the Supabase Edge Function **`vapi-webhook`** (`supabase/functions/vapi-webhook/index.ts`, Deno). It reads `message.analysis.structuredData` and writes to Postgres with the service-role key. This is the **only** integration/ingestion layer.
- **Storage (Supabase Postgres):** `leads` (base tier) + `enterprise_leads` (enterprise tier — full qualification profile). Both have RLS enabled. The base table uses Postgres enum types (`procedure_interest_enum`, `language_enum`); the Edge Function coerces out-of-range values so an insert never throws.
- **No separate automation layer.** Ingestion runs solely through the Edge Function. Outbound alerts (e.g. Telnyx SMS), if added, fire directly from it.

## 1. Project Context

Domain: Medical Tourism in Mexicali / Los Algodones.

Core Loop: WhatsApp Webhook -> LLM Router (Intent Classification) -> API Integration (Dentalink/Apify) -> WhatsApp Response.

Target Users: English-speaking Americans/Canadians and Spanish-speaking locals seeking dental appointments.

1. Strict Safety & Medical Guardrails (CRITICAL)

As an AI coding agent, you must strictly implement these guardrails in all system prompts and routing logic:

NO Medical Advice: The system must never diagnose, prescribe, or interpret symptoms.

Emergency Routing: Any detection of words like pain, bleeding, swelling, or infection MUST bypass the standard flow and immediately trigger a human handoff protocol.

Scope Limits: Confine LLM responses to logistics (border wait times, clinic hours, parking, payments) and scheduling.

1. Technology Stack & Coding Conventions

Language: TypeScript (Node.js) or Python (FastAPI). If a language is not explicitly specified by the user, default to TypeScript with Node.js/Express.

State Management: Redis for caching user session state and appointment locks.

Code Style:

Use strict typing (TypeScript) or Type Hints (Python).

Enforce modular architecture (separate files for routes, services, LLM prompts, and utilities).

Use early returns and throw descriptive errors.

Error Handling:

Never let the webhook crash. Always return a 200 OK to the caller (Telnyx/Vapi) even if internal processing fails, to prevent webhook disabling.

Log all errors to standard output with contextual data.

1. Development Workflow & Commands

When asked to initialize, build, or test the environment, use standard commands based on the selected stack.

Install: npm install or pip install -r requirements.txt

Dev Server: npm run dev or uvicorn main:app --reload

Testing: npm test or pytest

Environment Variables: Always use .env files. Never hardcode API keys (Meta, OpenAI/Anthropic, Dentalink, Apify). Provide a .env.example template.

1. Agentic Execution Rules

Plan Before Coding: Outline your architectural steps briefly before generating large blocks of code.

Incremental Delivery: Build the Webhook receiver first, test the echo, then add the LLM router, and finally attach the API actions.

Mock External APIs: When building the Dentalink or Doctoralia integration, implement a mock service first to test the conversation flow before requiring live credentials.
