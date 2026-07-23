# Sales packet — contract, annex, receipt, authorization, onboarding

Print-ready HTML for an in-person, walk-in close. Open in a browser and print to PDF or
paper — the on-screen yellow instruction boxes are `@media print` hidden, so they never
appear on the signed copy.

> **These are operating drafts, not legal advice.** A lawyer should review them before
> they are used with a real clinic. Two clauses in particular need a professional eye —
> see [Open questions](#open-questions-for-the-lawyer) below.

## The documents

| File | What it is | When it's signed |
| :-- | :-- | :-- |
| `contrato-de-servicio.html` | Services Agreement / order form. ES operative + EN courtesy translation. Prices, term, what the service does **and explicitly does not do**. | At the close |
| `anexo-a-datos-personales.html` | **Annex A** — LFPDPPP controller–processor agreement. Clinic = `responsable`, Baja Dental AI = `encargado`. | Same moment, alongside the contract |
| `cuestionario-de-alta.html` | Onboarding questionnaire. Collects the facts that fill the knowledge base. | Same visit or immediately after |
| `recibo-de-pago.html` | Numbered payment receipt, original + provider copy on one sheet. | On every payment |
| `carta-autorizacion-representante.html` | Authorizes a non-owner rep to present, sign and collect cash. | Once per representative |

**Signing order at the table:** contract → Annex A → receipt (if paying) → questionnaire.
The questionnaire can trail the others, but nothing goes live until it is filled in.

## Why the questionnaire is load-bearing

The assistant will only tell patients what the clinic supplies here. Every field carries a
blue tag (e.g. `STERILIZATION_PROTOCOL`) matching a placeholder in
`docs/dental_tourism_knowledge_base.txt` exactly — copy the clinic's answer to the
placeholder of the same name.

All **18** placeholders in the KB are covered by the questionnaire; this is verified, not
assumed. To re-check after editing either file:

```bash
for t in $(grep -o '\[[A-Z_0-9]*\]' docs/dental_tourism_knowledge_base.txt \
           | sort -u | tr -d '[]' | grep -v '^VARIABLE$'); do
  grep -q "$t" legal/cuestionario-de-alta.html && echo "  OK   $t" || echo " MISS  $t"
done
```

**An unanswered placeholder stays as-is.** The assistant then says a coordinator will
confirm that detail. Never fill one with an example, a guess, or another clinic's data —
that is precisely the failure the 2026-07-22 medical-claim purge removed from the KB.
See `docs/knowledge_base_onboarding.md`.

## Facts these documents encode

Pulled from `bajadental_site/terminos.html` and the live code — **if any of these change,
the contract changes with them.**

- **Seller:** Ronald Clay Mills, US sole proprietor, DBA "Baja Dental AI". No Mexican RFC.
- **No CFDI / factura.** Stated in the contract (clause 5) *and* printed on the receipt,
  because that is where the clinic's accountant looks. A numbered receipt is the only
  proof of payment issued.
- **Pricing:** $499 USD setup (waivable with `FUNDADOR`) + $499 USD/month; annual = 10
  months prepaid; 800 voice minutes/month included; $0.22 USD per additional minute.
- **Payment:** Zelle or cash USD.
- **Cancellation:** any time by email, effective end of the current billing period.

## What clause 3 promises the clinic

Clause 3 ("what the Service does NOT do") is the honesty clause and the reason this packet
can be signed without misrepresentation. Each denial was checked against the code, not the
marketing copy:

| Clause 3 says | Verified in |
| :-- | :-- |
| Does not book or confirm appointments; no calendar sync | `checkCalendarAvailability` returns `AVAILABILITY_UNKNOWN`; `bookAppointment` writes `status: 'requested'` |
| No medical advice, no diagnosis | `vapi_config/system_prompt.txt` emergency + scope rules |
| Asserts no credential the clinic did not supply | KB hard rules + persona ban list |
| No CRM integration, no dashboard | no such code exists; `clinic_staff` RLS has no policy |
| No WhatsApp | reminders are outbound voice (`reminder-dispatch`) |
| SMS on urgent **and** border-concern calls only — not every call | `index.ts`: `if (alertTo && (emergency \|\| anxious))` |

Clause 2.8 (reminder calls) is deliberately worded as **"activated during
implementation"** rather than already running: the code is deployed but inert until
`VAPI_OUTBOUND_PHONE_NUMBER_ID` and `CRON_SECRET` are set. Do not restate it as live.

## Open questions for the lawyer

1. **Governing law (clause 12).** The contract submits to Mexican law and Mexicali courts,
   mirroring clause 12 of the published `terminos.html`, while the seller is a US sole
   proprietor with no Mexican establishment. That combination is coherent only if it is
   deliberate. Whatever is decided, `terminos.html`, `aviso-de-privacidad.html` and this
   contract must be changed **together** — they currently agree, and that is worth
   preserving.
2. **Sensitive data.** Annex A clause 2 treats spontaneously-volunteered symptom mentions
   as potentially sensitive under art. 3(VI) LFPDPPP. The system never solicits clinical
   information, but transcripts can capture it. Confirm whether the clinic's own privacy
   notice needs express consent language for this, and whether the US transfer disclosure
   in Annex A clause 6 is sufficient as drafted.

## Reprinting and versioning

Edit the HTML, don't hand-edit printed PDFs. Receipt numbers (`RC-`), contract numbers
(`CT-`) and authorization numbers (`AR-`) are filled by hand and must run consecutively
with no gaps — the receipt book is the only payment record on the no-factura model.
