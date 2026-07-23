# Baja Dental AI 🦷🤖

> **Live:** [www.bajadentalai.com](https://www.bajadentalai.com) · **Repo:** `blendlytech/bajadentalai` · **Deploy:** see [`DEPLOY.md`](DEPLOY.md)

A high-converting, deeply localized AI Receptionist designed specifically for premium dental clinics in Mexicali (Zona Médica) and Los Algodones ("Molar City").

This project provides the system prompts, data schemas, webhook logic, and strategic workflows to deploy an AI agent capable of handling inbound inquiries from US and Canadian tourists seeking affordable dental care across the border.

## 🎯 Core Features

- **The "Spanglish" Conversational Engine**: The AI answers in a professional, welcoming Northern Mexican Spanish (Baja dialect). The moment the user speaks English, it instantly code-switches to flawless, empathetic, native-sounding American English.
- **Border-Region Dental Vocabulary**: Accurately utilizes regional terminology (e.g., *carillas* for veneers, *coronas* for crowns, *presupuesto* for quote/estimate, and All-on-4 implants).
- **Aggressive Conversion**: Designed to remove friction for American tourists, aggressively but politely pushing for booked consultations and upfront deposits.
- **Logistics & Border Context**: Pre-programmed to answer questions about border crossing, medical lane passes (FastPass), clinic parking, and walking distances from the port of entry.
- **AI Voice Reminders & Confirmations**: Outbound Vapi calls (over Telnyx) ring the patient ~24h before the appointment to remind and confirm, updating `appointments.reminder_status`. Missed-appointment win-back calls are on the roadmap. Reminders/win-backs are delivered by **voice call, not WhatsApp** — the Meta/WhatsApp Business route was dropped (verification friction). WhatsApp stays only as the clinic contact channel.
- **LFPDPPP Compliance**: Includes standard Mexican data privacy clauses ("Para fines de calidad, esta llamada es grabada").

## 🛠️ Technology Stack (Bootstrapped)

This project is built to operate on a highly efficient, minimal-budget stack:

- **Vapi.ai**: Core voice AI conversational engine (using Cartesia voices and Deepgram transcriber).
- **Telnyx**: Telephony — the inbound phone number (`TELNYX_PHONE_NUMBER` in `.env`) routed to the Vapi assistant via a BYO SIP trunk.
- **Supabase**: Primary PostgreSQL database (`leads` + `enterprise_leads`) plus the **`vapi-webhook` Edge Function** (Deno), which catches the Vapi `end-of-call-report` and writes leads directly.
- **Vapi Web SDK**: Used for a one-click local web demo to pitch clinics without requiring mobile verification or complex SIP trunks during the sales process.
- **Google Antigravity IDE & Claude Code Pro**: The primary development environment and builder AI used to orchestrate the skills and payloads.

## 📁 Repository Architecture

- `docs/`: Contains the strategic playbooks, including the **Bootstrap Execution Manual** and the **Agent Skill Configurations**.
- `.agents/skills/` (Symlinked from `.claude/skills/`):
  - `vapi-spanglish-persona`: System prompts enforcing the Northern Mexican Spanish / English code-switching.
  - `build-vapi-web-demo`: Scaffolding for the offline laptop walk-in pitch interface.

## 🚀 Getting Started

1. Read the **Bootstrap Execution Manual** located in `docs/` for the exact step-by-step pitch and deployment protocol.
2. Review the **Agent Skill Configurations** to understand how to load the AI personas into the Antigravity IDE.
3. Deploy the web demo locally using the provided Vapi Web SDK script to start pitching clinics in Zona Médica.

---
*Built for the border.*
