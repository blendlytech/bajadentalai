# Execution Protocol: Mexicali Dental AI Receptionist Demo

> ⚠️ **Historical / superseded** — predates the current AI-voice architecture (single "Consultorio Completo" plan; reminders/win-backs by outbound Vapi voice call, not WhatsApp). Kept for history. See `CLAUDE.md` → "Current Architecture (AUTHORITATIVE)".

This document outlines the step-by-step execution plan to build, configure, and pitch the AI Receptionist demo using a strict zero-phone bootstrap approach.

## 1. Environment & Skill Setup

1. **Configure Antigravity IDE**: Set the model to Gemini 3.1 Pro by creating `.agents/settings.json`:
   ```json
   {  
     "antigravity.ai.model": "gemini-3.1-pro",  
     "antigravity.agent.enabled": true,  
     "antigravity.agent.model": "gemini-3.1-pro"  
   }
   ```
2. **Symlink Agent Skills**: Ensure all `.claude/skills` are correctly symlinked to `.agents/skills` to guarantee access to the 2 core skills: `vapi-spanglish-persona` and `build-vapi-web-demo`.

## 2. Infrastructure & Telephony Bootstrapping

1. **Bypass 2FA**: Utilize Skype or Google Voice desktop to acquire a VoIP number for receiving SMS verification during account creation.
2. **Domain & Routing**: Purchase a promo domain via Namecheap. Configure Cloudflare Email Routing to forward a professional alias (e.g., `hola@yourdomain.xyz`) to your personal Gmail.
3. **Telnyx Provisioning**: Create a Telnyx account and provision a phone number routed to your Vapi assistant.
4. **Vapi Initialization**: Create a Vapi.ai account to utilize the free $10 tier.

## 3. Vapi Agent Architecture & Persona Configuration

1. **Invoke `vapi-spanglish-persona` Skill**: Generate the Vapi assistant configuration.
   - **Target Endpoint**: `POST https://api.vapi.ai/assistant`
   - **JSON Payload Structure**:
     ```json
     {
       "name": "Mexicali Dental Receptionist",
       "voice": {
         "provider": "cartesia",
         "voiceId": "<bilingual_voice_id>"
       },
       "transcriber": {
         "provider": "deepgram",
         "model": "nova-2-conversationalai"
       },
       "model": {
         "provider": "openai",
         "model": "gpt-4o",
         "messages": [
           {
             "role": "system",
             "content": "You are a bilingual dental receptionist in Mexicali. You must always answer the phone in a professional, welcoming Northern Mexican Spanish accent (Baja dialect). Include the LFPDPPP Compliance Clause in the initial greeting: 'Para fines de calidad, esta llamada es grabada.' The moment the user speaks English, instantly code-switch to flawless, empathetic, native-sounding American English. Accurately utilize border-region dental terminology (carillas, coronas, implantes All-on-4, presupuesto). Aggressively but politely push for a booked consultation or an upfront deposit. Provide border crossing context (FastPass, clinic parking, walking distance from the port of entry)."
           }
         ]
       }
     }
     ```

## 4. Telnyx to Vapi Bridging

1. **Bind the Telnyx number to Vapi**: Route the Telnyx number to Vapi via a BYO SIP trunk (see `vapi_config/telnyx_sip_setup.sh`).
   - **Target Endpoint**: `POST https://api.vapi.ai/phone-number`
   - **JSON Payload Structure**:
     ```json
     {
       "provider": "sip",
       "number": "+1760XXXXXXX",
       "assistantId": "<generated_assistant_id>",
       "name": "Telnyx Primary MX Routing"
     }
     ```
2. **Telnyx SIP Routing**: In the Telnyx portal, create a SIP Connection and point the number's inbound routing to `sip:<number>@sip.vapi.ai`.

## 5. Webhook Extraction (Supabase Edge Function)

1. **Deploy the `vapi-webhook` Edge Function**: Configure post-call extraction to write structured data straight to Supabase.
   - **Server URL (set on the Vapi assistant)**: `https://<project>.supabase.co/functions/v1/vapi-webhook`
   - **Payload Logic**: Read Vapi's structured outputs from `message.analysis.structuredData`.
   - **Schema**:
     ```json
     {
       "type": "object",
       "properties": {
         "patient_name": { "type": "string" },
         "procedure_interest": { 
           "type": "string", 
           "enum": ["veneers", "implants", "whitening"] 
         },
         "language_spoken": { "type": "string" }
       },
       "required": ["patient_name", "procedure_interest", "language_spoken"]
     }
     ```
   - **Constraint**: Process only `end-of-call-report`; return 200 for all other event types.

## 6. The Web SDK Demo Interface (Offline Walk-In)

1. **Invoke `build-vapi-web-demo` Skill**: Generate the `index.html` scaffolding for the offline demo.
   - **Expected UI/UX**: A clean, modern, medical-themed single-page interface featuring a prominent "Start Call" button. No backend setup or React build step—purely HTML/JS/CSS embedded in one file.
   - **Execution**: The script will bind the local microphone (`navigator.mediaDevices.getUserMedia`) and hardcode the Vapi Public Key and Assistant ID to connect instantly.
   - **Hosting**: Serve locally via Antigravity's built-in live server.

## 7. Field Execution & The Pitch

1. **Target Selection**: Use Perplexity Pro to select clinics in Zona Médica that have poor phone response reviews but high procedure volume.
2. **The Drop-In**: Walk into the clinic and present the laptop demo using guest Wi-Fi.
3. **The Script**: *"Hola, busco a la gerente de clínica. Sé que están perdiendo pacientes americanos porque las líneas se saturan."*
4. **The Demo**: Click "Start Call" on the local HTML page and instruct the manager: *"Pregúntale cuánto cuestan las carillas en inglés."*
5. **The Close**: Secure a **$500–$750 setup deposit** and sign the $1,500/month pilot. Post-deposit, immediately acquire an Android phone and transition to BYOC SIP trunking and Synthflow for production.
