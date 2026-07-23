# **Zero-Phone Bootstrap Execution Manual: Mexicali Dental AI**

> ⚠️ **Historical / superseded** — predates the current AI-voice architecture (single "Consultorio Completo" plan; reminders/win-backs by outbound Vapi voice call, not WhatsApp). Kept for history. See `CLAUDE.md` → "Current Architecture (AUTHORITATIVE)".

This protocol outlines the exact steps to build, deploy, and pitch an AI Receptionist using only your current desktop software stack and a strict \<$25 budget.

## **The Tool Stack Allocation**

To maximize efficiency, assign your AI subscriptions to the following specific tasks:

1. **Perplexity Pro (The Scout):** Deep market research, scraping target clinic websites, extracting their specific pricing, procedures (e.g., "All-on-4 implants"), and staff names in Los Algodones and Zona Médica.  
2. **Gemini 3.1 Pro (The Architect):** High-level system design, complex Spanglish prompt engineering, and conversational logic tuning.  
3. **Google Antigravity IDE \+ Claude Code Pro (The Builder):** Generating the Vapi API configurations, writing webhook logic, and building the web-based demo interface to bypass your lack of a cell phone.

## **Phase 1: Overcoming the "No Phone" Barrier**

You need a way to receive 2FA SMS texts to sign up for Telnyx/Vapi, and a way to demo the product without a mobile device.

1. **The 2FA Workaround:** Download Skype or use Google Voice on your desktop. Buy a cheap ($3-$5) VoIP number that can receive SMS texts. You will use this *only* for creating your Telnyx and Cloudflare accounts.  
2. **The Demo Workaround:** You will use Vapi's Web SDK. You will bring your laptop into the clinic, connect to their guest Wi-Fi (or a desktop hotspot if you have a separate mobile broadband device), and demo the AI directly through your computer's microphone and speakers.

## **Phase 2: Digital Foundation (\< $5)**

1. **Purchase Domain:** Buy a $1.00 \- $2.00 promo domain (e.g., .xyz or .site) via Namecheap.  
2. **Cloudflare Email Routing (Free):**  
   * Add your domain to a free Cloudflare account.  
   * Go to "Email Routing" and create a custom address (e.g., <hola@yourdomain.xyz>).  
   * Forward it to your personal Gmail.  
   * *Agent Action:* Have Gemini generate your professional outreach templates to send from this alias.

## **Phase 3: Telephony & Telnyx Setup**

1. **Create Telnyx Account:** Sign up and fund the absolute minimum.  
2. **Provision a Local Number:** Provision a phone number via Telnyx to route inbound calls to your Vapi assistant.  
3. **Configure SIP/Webhooks:** Point this Telnyx number's voice routing to your Vapi assistant endpoint in Phase 4 (see `vapi_config/telnyx_sip_setup.sh`).

## **Phase 4: Vapi AI Engineering ($0 \- Uses $10 Free Credit)**

1. **Account Creation:** Sign up for Vapi.ai to claim your $10 in trial credits.  
2. **Agent Assembly via Google Antigravity & Claude:**  
   * Open Antigravity IDE.  
   * Instruct Claude Code Pro to generate a vapi-config.json payload.  
   * *System Prompt Injection (Let Gemini write this):* "You are a bilingual dental receptionist in Mexicali. You speak Northern Mexican Spanish but immediately switch to fluent English if the user speaks English. Your goal is to book a consultation for veneers. You are polite but efficient."  
   * Set the Voice Provider to Cartesia (included in Vapi) and select a bilingual voice profile.  
3. **Link Telnyx to Vapi:** Bind your Telnyx number to Vapi via a BYO SIP trunk (run `vapi_config/telnyx_sip_setup.sh`) and complete the SIP Connection routing in the Telnyx portal.

## **Phase 5: Database & Lead Routing (Supabase Edge Function)**

1. **Supabase Initialization:** Create a free project on Supabase.
2. **Schema Execution:** Create a `leads` table with columns for `patient_name`, `procedure_interest`, and `language_spoken`.
3. **Edge Function Ingestion:** Deploy the `vapi-webhook` Edge Function to catch the Vapi `end-of-call-report` and insert the structured data straight into your Supabase database.

## **Phase 6: The Web-SDK Demo Interface (Crucial Step)**

Since you cannot hand them a phone, you must build a one-click web demo.

1. **Generate the App:** In Google Antigravity IDE, prompt Claude Code Pro: *"Write a single-file HTML/JS web app using the Vapi Web SDK. It should have a clean, modern, medical-themed UI with a large 'Start Call' button. Hardcode my Vapi Public Key and Assistant ID so it connects instantly to the microphone."*  
2. **Local Hosting:** Serve this HTML file locally on your laptop using Antigravity's built-in live server.

## **Phase 7: The Laptop Walk-In Pitch**

1. **Target Selection:** Use Perplexity Pro to identify 3 clinics in Zona Médica with high reviews but complaints about "hard to reach by phone."  
2. **The Drop-In:** Walk in with your laptop open or easily accessible.  
3. **The Script:**  
   * *"Hola, busco a la gerente de clínica. Sé que están perdiendo pacientes americanos porque las líneas se saturan."* (Hi, I'm looking for the clinic manager. I know you're losing American patients because the phone lines get backed up.)  
   * *"I built a custom AI specifically for your clinic to handle 100% of overflow calls in perfect English and Spanish. Can I show you how it sounds? It takes 30 seconds."*  
4. **The Demo:** Place the laptop on the counter. Press the 'Start Call' button on your local Antigravity web app. Tell the manager: *"Pregúntale cuánto cuestan las carillas en inglés."* (Ask it how much veneers cost in English).  
5. **The Close:** Propose the $1,500/month pilot. Require a **$500 to $750 setup deposit** via Stripe or local wire transfer.

**Next Step Post-Deposit:** The second that deposit hits your account, go buy an unlocked Android phone, transition to the Phase 2 Production stack (Synthflow \+ BYOC SIP Trunking), and deploy their live number.
