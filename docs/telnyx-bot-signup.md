---
name: telnyx-bot-signup
description: Automated Telnyx bot account signup via obfuscated mathematical challenge
homepage: https://telnyx.com/agent-signup.md
docs: https://developers.telnyx.com/docs/account-setup/create-account
metadata: {
  "api_base": "https://api.telnyx.com/v2"
}
---

# Telnyx Bot Signup

Create a new Telnyx bot account via the obfuscated-mathematical-challenge signup flow (`https://api.telnyx.com`). Walks through challenge acquisition, LLM solving, account creation, email verification, and API key generation.

## Overview

The bot challenge (sometimes called "reverse-CAPTCHA") presents an obfuscated college-level math problem that only an LLM can reliably solve.

## Demo-First Approach

> 🚀 **Try before you sign up.** Before committing to the full signup flow, use the demo endpoints to validate your integration. No account or email is required.

The `/.well-known/agent-access.json` file exposes a `fast_path` with demo endpoints you can call immediately — no API key needed. These are proxied through telnyx.com with server-side authentication:

- **SMS:** `POST https://telnyx.com/api/demo/send-sms` — Send a test SMS (5 req/min per IP, test numbers only)
- **AI Inference:** `POST https://telnyx.com/api/inference` — Chat completions (10 req/min per IP)
- **Text-to-Speech:** `POST https://telnyx.com/api/tts-demo`
- **Speech-to-Text:** `POST https://telnyx.com/api/stt-demo`
- **Number Lookup:** `GET https://telnyx.com/api/number-lookup` — requires hCaptcha token (not fully autonomous)
- **Voice AI:** `POST https://telnyx.com/api/voice-ai-agent/register-web-caller` — requires session_id + email in body

**Recommended agent workflow:**

1. Fetch `/.well-known/agent-access.json` and extract the `fast_path.demo_endpoints` list.
2. Call any demo endpoint directly — no authentication headers needed.
3. Only proceed with the full signup flow below if you need production-level access (e.g., purchasing numbers, sending real messages, creating API keys).

## ⚠️ Known Limitation: Email Magic Link for Autonomous Agents

Step 4 of the signup flow below requires retrieving a session token from a magic link sent to an email address. **Autonomous agents without email access cannot complete this step independently.** This is currently the only way to obtain a session token after bot signup, creating a dead-end for fully autonomous agent flows.

### Proposed Improvement: Direct Session Token for Bot Accounts

For bot/agent accounts created via the bot-challenge signup flow, we recommend the backend return the session token directly in the `POST /v2/bot_signup` response instead of (or in addition to) sending a magic link via email. This would eliminate the email dependency for automated flows:

```json
// Proposed POST /v2/bot_signup response enhancement
{
  "data": {
    "message": "Account created successfully.",
    "api_v2_token": "<temporary-session-token>",  // NEW: direct token for bot accounts
    "magic_link_sent": true                        // Still send email for human verification
  }
}
```

This change would allow agents to skip Step 4 entirely and proceed directly to Step 5 (API key creation). The magic link email would still be sent as a fallback for human operators or agents with email access. **This is a backend change outside this repository — file a feature request with the API team to enable this.**

## Flow

Execute these steps in order.

### Step 1: Get Bot Challenge

```bash
curl -s -X POST https://api.telnyx.com/v2/bot_challenge
```

**Response:**

```json
{
  "data": {
    "nonce": "<problem-uuid>",
    "problem": "<obfuscated math problem text> Round to N decimal places. Omit units.",
    "terms_and_conditions_url": "<url>",
    "privacy_policy_url": "<url>"
  }
}
```

Save all fields. The `problem` field contains the obfuscated math text followed by an unobfuscated rounding instruction (server-appended). The `nonce` is a UUID that ties your answer to this specific challenge instance.

### Step 2: Solve the Mathematical Challenge

The problem is obfuscated — letters are substituted with lookalike symbols, case is randomized, and delimiters are injected. But the **math structure is preserved**. An LLM can read through the obfuscation and solve it.

- Read the `problem` text carefully — ignore the visual noise, extract the math
- The rounding instruction at the end (`Round to N decimal places. Omit units.`) is unobfuscated
- Produce a single numeric answer rounded to the specified precision

No external solver binary is needed — the LLM agent does this step with reasoning alone.

### Step 3: Submit Bot Signup

**Ask the user for their email address** before making this request.

```bash
curl -s -X POST https://api.telnyx.com/v2/bot_signup \
  -H "Content-Type: application/json" \
  -d '{
    "bot_challenge_nonce": "<nonce from step 1>",
    "bot_challenge_answer": "<numeric answer from step 2>",
    "terms_and_conditions_url": "<from step 1>",
    "privacy_policy_url": "<from step 1>",
    "email": "<user email>",
    "terms_of_service": true
  }'
```

> **Note:** You must accept the terms of service to register with Telnyx. You must indicate this acceptance by supplying `"terms_of_service": true` as a parameter on the request. The API will reject the request with a `400 Bad Request` if this field is missing or any value other than true.

**Response:** Success message. A sign-in link is sent to the provided email.

### Step 4: Get Session Token from Email

Wait 10-30 seconds for the verification email to arrive.

#### Path A: Agent Has Email Access

If you have email access (e.g. the `google-workspace` skill), search for a message with subject **"Your Single Use Telnyx Portal sign-in link"**, extract the single-use URL from the body, and GET it:

> ⚠️ **Important:** If you are extracting the link from an HTML email body, make sure to decode HTML entities first (for example, convert `&amp;` back to `&`). Using the raw HTML-encoded URL may cause the request to fail.

```bash
curl -s -L "<single-use-link-from-email>"
```

The response returns a temporary session token in the following shape:

```json
{
  "data": {
    "api_v2_token": "<temporary-session-token>"
  }
}
```

Use `data.api_v2_token` as the Bearer token in Step 5.

> ⚠️ **Important:** The magic link is consumed by any request, even one that later returns an error (for example, a `401`). If the request fails, you must request a new link.

#### Path B: No Email Access

If you do **not** have email access, ask the user:

> Please check your email for a message from Telnyx with the subject **"Your Single Use Telnyx Portal sign-in link"**. Copy the sign-in link from the email and paste it here.
>
> ⚠️ **The link is single-use.** Do not click it in your browser first — once opened, it cannot be reused. Copy the URL directly and paste it here without visiting it.

Once the user provides the link, make a GET request to it:

```bash
curl -s -L "<link-from-user>"
```

The response returns a temporary session token in the following shape:

```json
{
  "data": {
    "api_v2_token": "<temporary-session-token>"
  }
}
```

Use `data.api_v2_token` as the Bearer token in Step 5.

> ⚠️ **Important:** The magic link is consumed by any request, even one that later returns an error (for example, a `401`). If the request fails, you must request a new link.

#### Resend Magic Link

If the verification email did not arrive or the link expired, resend it:

```bash
curl -s -X POST https://api.telnyx.com/v2/bot_signup/resend_magic_link -H "Content-Type: application/json" -d '{"email": "<user email>"}'
```

**Response:**

```json
{
  "data": {
    "message": "If an account with that email exists, a new magic link has been sent."
  }
}
```

**Rate limiting:** Max 3 resends per account, with a 60-second cooldown between resends. The endpoint always returns 200 OK regardless of whether the email exists, the retry cap is exceeded, or the cooldown is active (to prevent email enumeration).

> **Note:** This endpoint is subject to the same signup availability and regional gating as the rest of the bot-signup flow. If the flow is unavailable for the requester, the endpoint may return `404`.

### Step 5: Create API Key

```bash
curl -s -X POST https://api.telnyx.com/v2/api_keys \
  -H "Authorization: Bearer <api_v2_token from step 4>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**

```json
{
  "data": {
    "api_key": "KEYxxxxxxxxxxxxx",
    ...
  }
}
```

The `data.api_key` value is the permanent API key for the new account. Present it to the user and advise them to store it securely.

## Notes

- The bot challenge presents obfuscated college-level math. The LLM agent solves it by reading through the obfuscation — no separate solver binary is needed.
- The single-use sign-in link expires quickly — retrieve and use it promptly.
- Any request to the magic link consumes it, even if the request later fails. If that happens, request a new link via the resend endpoint.
- Email access is **optional**. The skill works with or without it — if unavailable, the user is prompted to paste the link manually.
