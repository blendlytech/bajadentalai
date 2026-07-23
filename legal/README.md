# Sales packet — contract, annex, receipt, authorization, onboarding

Print-ready HTML for an in-person, walk-in close. Open in a browser and print to PDF or
paper — the on-screen yellow instruction boxes are `@media print` hidden, so they never
appear on the signed copy.

> **These are operating drafts, not legal advice.** A lawyer should review them before
> they are used with a real clinic. Four risks are structural and no clause fully removes
> them — see the [Risk register](#risk-register--read-this-part) below, which is the most
> important part of this file.

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

## Risk register — read this part

A second review pass (2026-07-23) found gaps the first draft missed. The contract now
addresses them, but **four risks are structural and no contract clause fully removes
them.** They are ranked by what could actually cost the most.

### 1. TCPA — outbound AI reminder calls to US mobile phones ⚠️ highest financial risk

The reminder loop places **artificial-voice calls**, and the patients are largely
Americans on US cell numbers. Under the US Telephone Consumer Protection Act that requires
the recipient's **prior express consent**, with statutory damages of **$500–$1,500 per
call** and a well-developed class-action bar. The FCC has confirmed AI-generated voices are
"artificial" for TCPA purposes. This is a US federal claim against a **US person** — the
Mexicali forum clause does not shield it, and neither does the clinic being Mexican.

Contract now: clause 7.5 makes the clinic warrant it holds consent and notify revocations
within 24h; clause 10 has the clinic indemnify for TCPA claims. **That shifts the risk on
paper but does not stop a patient suing Mills directly.** Before the reminder loop is
switched on, get counsel on whether any healthcare-treatment exemption applies, and require
proof of consent capture rather than a bare warranty.

### 2. Sole proprietorship = unlimited personal liability ⚠️ structural

There is no liability shield. A judgment reaches personal assets — house, savings, vehicle.
Every cap and indemnity in the contract is only as good as the counterparty's willingness
and ability to pay. **The single highest-value legal step available is forming an entity**
(LLC or equivalent) and moving the contracts into it. Clause 16 already permits assigning
this agreement to an entity Mills owns, on written notice, specifically so existing
contracts can migrate without re-signing. Pair it with **E&O / tech-liability insurance**;
insurance is what actually pays claims when a cap fails.

### 3. Permanent establishment — Mexican tax exposure ⚠️ contradicts the no-factura posture

A dependent agent who **habitually concludes contracts** in Mexico for a foreign resident
can create a *establecimiento permanente*, dragging the business into Mexican tax
obligations — the opposite of the US-only/no-CFDI model the whole packet is built on. The
first draft of the rep letter authorized exactly that pattern.

Mitigated: the rep may now only **transmit** a signed offer; the contract is not formed
until Mills countersigns (contract clause 23, rep letter clauses 2 and 3 bis). Confirm with
a Mexican tax advisor before scaling, especially if in-person visits become routine.

### 4. Governing law — the seller litigates abroad

The contract submits to Mexican law and Mexicali courts, mirroring `terminos.html` clause
12, while the seller is a US sole proprietor. That means litigating in Spanish, under
Mexican law, without Mexican counsel. It is also what a Mexican clinic will actually sign,
and a US judgment would be hard to enforce against a Mexican clinic anyway — so this may
be the right trade. It is now a deliberate one, with a 30-day good-faith negotiation step
first (clause 20). **`terminos.html`, `aviso-de-privacidad.html` and this contract must
change together** — they currently agree, which is worth preserving.

### Also fixed in this pass

- **Liability cap was at risk of being void in full.** Under art. 2106 of the Código Civil
  Federal a waiver of liability for *dolo* is a nullity. A flat cap with no carve-out can
  be struck down as a whole. Clause 9.6 now carves out *dolo*/gross negligence **and**
  states that the carve-out's invalidity does not take the rest of the cap with it.
- **No indemnification existed at all** — the largest gap in the first draft. Clause 10 now
  covers false clinic-supplied information, missing patient consent, clinical acts and
  omissions (including an ignored emergency handoff), and data-controller breaches.
- **LFPDPPP citations were to a repealed statute.** The 2010 law was abrogated by the new
  LFPDPPP published 20 March 2025 (in force 21 March 2025); **INAI no longer exists**, its
  functions having passed to the Secretaría Anticorrupción y Buen Gobierno. The new law
  also **widened the range of regulated parties**, so the *encargado* may carry direct
  statutory duties. Annex A is updated and now flags that article numbers must be verified
  against the current text before signature.
- **Missing boilerplate that actually matters:** severability and survival (so one bad
  clause cannot sink the contract), force majeure, assignment, notices, independent
  contractors, entire agreement — the last of which kills "but your rep told me…" claims.
- **Emergency-detection failure was unallocated.** Clause 9.3 now states plainly that the
  assistant may miss or misread an emergency, that the clinic keeps its duty of care, and
  that it must maintain an alternative route to a human.
- **Recording consent.** The clinic may not ask for the disclosure to be disabled —
  California and other states require all-party consent, and that greeting is the defense.
- **Data retention could destroy evidence.** Annex A auto-deleted 30 days after
  termination; it now honors a written litigation-hold instruction.
- **Phone number ownership on exit** was undefined and is a predictable dispute (clause 14).
- **Insurance** — clause 11 makes the clinic state its malpractice cover, or expressly
  declare it has none.

## Reprinting and versioning

Edit the HTML, don't hand-edit printed PDFs. Receipt numbers (`RC-`), contract numbers
(`CT-`) and authorization numbers (`AR-`) are filled by hand and must run consecutively
with no gaps — the receipt book is the only payment record on the no-factura model.
