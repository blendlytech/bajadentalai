# Baja Dental AI: Multi-Tenant Onboarding Runbook

Use this runbook every time you close a new dental clinic. This guarantees that their data is isolated, their AI is legally compliant, and their telephony is routed correctly into our centralized webhook.

---

### Step 1: Database & Tenant Provisioning
Before touching Vapi or Telnyx, you must provision the tenant in Supabase to generate their unique `clinic_id`.

1. Go to your Supabase SQL Editor.
2. Create the new clinic record:
   ```sql
   INSERT INTO public.clinics (name) VALUES ('[CLINIC_NAME]') RETURNING id;
   ```
   *Save this UUID. This is the `clinic_id`.*
3. Go to **Authentication** -> **Users** and invite the clinic's sales closer via email.
4. Once they are created, get their `user_id` (UUID) and map them to the clinic:
   ```sql
   INSERT INTO public.clinic_staff (user_id, clinic_id) VALUES ('[USER_ID]', '[CLINIC_ID]');
   ```
   *This activates Row Level Security so they can log in and view their leads.*

---

### Step 2: Telephony Provisioning (Telnyx)
1. Log in to the [Telnyx Portal](https://portal.telnyx.com/).
2. Go to **Numbers** -> **Search & Buy** and purchase a local US number (e.g., 760 area code for Calexico/Baja routing).
3. Go to **Numbers** -> **My Numbers**.
4. Assign the new number to the existing SIP Connection: `"Vapi Spanglish Routing"`.
   *(If this doesn't exist, see `vapi_config/telnyx_sip_setup.sh` for SIP Connection creation instructions).*

---

### Step 3: Assistant Provisioning (Vapi)
1. **Prepare the Knowledge Base:**
   * Open `docs/dental_tourism_knowledge_base.txt`.
   * Replace all bracketed variables (Prices, Warranties, Sterilization) with the specific clinic's facts.
   * Save this as a new file (e.g., `kb_clinic_name.txt`).
2. **Clone the AI:**
   * In the Vapi Dashboard, duplicate your golden "Sofía" baseline assistant.
   * Rename it (e.g., "Sofía - [Clinic Name]").
3. **Attach the KB:**
   * Upload the customized `kb_clinic_name.txt` to the new assistant's Knowledge Base section.
4. **Configure Webhook & Metadata (CRITICAL):**
   * Go to the Assistant's **Advanced / Server** settings.
   * Ensure the **Server URL** points to our central Edge Function: 
     `https://gldxvazsoqxyfuxeursn.supabase.co/functions/v1/vapi-webhook`
   * In the **Metadata** JSON block, you MUST inject the `clinic_id` generated in Step 1, as well as the closer's alert phone number:
     ```json
     {
       "clinic_id": "<UUID_FROM_STEP_1>",
       "clinic_alert_phone": "+17605551234"
     }
     ```
   *Save the new Assistant ID.*

---

### Step 4: SIP Binding
You must tell Vapi that the new Telnyx number belongs to this new Assistant.
Run this curl command in your terminal (replacing the brackets with your actual values):

```bash
curl --request POST \
  --url https://api.vapi.ai/phone-number \
  --header "Authorization: Bearer <YOUR_VAPI_PRIVATE_KEY>" \
  --header "Content-Type: application/json" \
  --data '{
    "provider": "sip",
    "number": "<NEW_TELNYX_NUMBER_WITH_+1>",
    "assistantId": "<NEW_VAPI_ASSISTANT_ID>",
    "name": "Telnyx - [Clinic Name]"
  }'
```

---

### Step 5: Verification
1. Call the new Telnyx number.
2. Ask a question specific to the customized Knowledge Base (e.g., "How much is an All-on-4?"). Verify it answers with the *clinic's* specific pricing.
3. Hang up.
4. Check the Supabase `leads` and `enterprise_leads` tables. Verify a new row appears and the `clinic_id` matches the UUID you generated in Step 1.

---

### Step 6: Enable AI voice appointment reminders (outbound)
Reminders and confirmations are delivered by **outbound AI voice call (Vapi + Telnyx) — NOT WhatsApp.**
1. **Appointments flow:** confirm bookings land in `public.appointments` with this `clinic_id` (the `bookAppointment` tool writes them; `reminder_status` defaults to `pending`).
2. **Outbound number:** ensure the clinic's Telnyx number is registered in Vapi as an **outbound** phone number; note its `phoneNumberId`.
3. **Reminder assistant:** confirm the shared reminder assistant ("Sofía – Recordatorios", `vapi_config/reminder_call_prompt.txt`) exists and its Server URL points to the central `vapi-webhook`.
4. **Secrets:** verify the `reminder-dispatch` function has `VAPI_API_KEY`, `VAPI_REMINDER_ASSISTANT_ID`, `VAPI_OUTBOUND_PHONE_NUMBER_ID`. The `pg_cron` job (~every 20 min) triggers it.
5. **Test:** insert a test `appointments` row for this `clinic_id` ~24h out with your own number; run `reminder-dispatch`; answer the call and confirm the reminder script + LFPDPPP recording notice; verify `appointments.reminder_status` flips `pending` → `called` → `confirmed`.
