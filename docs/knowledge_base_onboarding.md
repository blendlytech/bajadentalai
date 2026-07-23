# Knowledge base onboarding — filling `dental_tourism_knowledge_base.txt`

**This file is NOT uploaded to Vapi.** Only
`docs/dental_tourism_knowledge_base.txt` is. Keep it that way: the KB deliberately
contains no example values and no instructions-to-the-model, because anything written
in it can be spoken to a patient as fact.

## Why the examples were removed (2026-07-22)

The KB previously used placeholders like `[CREDENTIALS, e.g., board-certified and
received their post-graduate training in the US]` and
`[STERILIZATION_PROTOCOL, e.g., OSHA-level sterilization protocols]`. An LLM reading
that will happily paraphrase the **example** as a factual claim about the clinic. It
also carried unbracketed hard claims the assistant would state verbatim to every
caller — "identical to those used in the United States and Canada", "the Zona Médica
is highly secure", "the exact same high-end brands used in Beverly Hills", "the
procedure is entirely painless", "can easily last 15 to 20 years".

Two separate problems with that:

1. **Liability.** Those are representations about a clinic you don't control. "OSHA"
   is a US *workplace* regulator that does not certify Mexican dental clinics, so
   "OSHA-level" was both meaningless and misleading. Safety assurances about a
   physical area, and comparative price claims, need substantiation you don't have.
2. **It broke the product's own guardrail.** `CLAUDE.md` states: no medical advice,
   no diagnosing, no interpreting symptoms. Telling a patient a root canal is
   "entirely painless" is a clinical assurance.

The rewritten KB routes every clinical question to the dentist and every unverified
detail to a coordinator.

## Rules when filling this in

- Write only what the clinic can **evidence in writing**. If they can't produce it,
  leave the answer general and let a coordinator handle it.
- Never reintroduce: accreditation names the clinic doesn't hold, "OSHA", equivalence
  claims to US/Canadian standards, safety guarantees about travel or neighbourhoods,
  pain/comfort predictions, or lifespan guarantees.
- Comparative pricing ("in the US this costs X") is advertising. Only include it with
  a substantiated source, or omit it — the rewritten KB omits it by default.
- Warranty text must match the clinic's actual written warranty document, verbatim.
- Replace **every** variable. Any left unreplaced will make the assistant defer to a
  coordinator, which is safe but sounds unfinished.

## Variable checklist

| Variable | What to put |
| :-- | :-- |
| `[CLINIC_NAME]` | Clinic's legal/trading name as patients know it |
| `[STERILIZATION_PROTOCOL]` | Their actual, documented infection-control practice |
| `[FACILITY_DETAILS]` | Equipment/rooms the clinic verifiably has |
| `[CREDENTIALS]` | Real degrees/licences/specialisations, as documented |
| `[IMPLANT_BRANDS_AND_MATERIALS]` | Brands actually stocked and used |
| `[CLINIC_ADDRESS_AND_AREA]` | Street address and district |
| `[TRANSPORTATION_SERVICES]` | Transport/escort the clinic genuinely provides |
| `[WARRANTY_TERMS]` | Verbatim from the written warranty |
| `[ALL_ON_4_PHASE_1_DAYS]` | Typical Phase-1 stay |
| `[ALL_ON_4_HEALING_MONTHS]` | Typical healing interval |
| `[ALL_ON_4_PHASE_2_DAYS]` | Typical Phase-2 stay |
| `[PAYMENT_METHODS]` | Payment methods actually accepted |
| `[ALL_ON_4_PRICE_RANGE]` | Current price range per arch |
| `[VENEER_CROWN_PRICE_RANGE]` | Current price range per tooth |
| `[VENEER_OPTIONS_AND_PRICING]` | Veneer types offered and pricing |
| `[ROOT_CANAL_PRICE_RANGE]` | Current price range |
| `[ORTHO_SERVICES]` | Aligner/ortho services offered |
| `[ORTHO_PRICE_RANGE]` | Current price range |

## Before going live for a clinic

1. Every variable replaced with evidenced content.
2. A dentist or the clinic owner has **read and signed off** on the final text — it
   speaks in their name.
3. Re-read for anything that predicts how treatment will feel, promises an outcome, or
   asserts a standard/certification. Remove it.
4. Upload as that clinic's Vapi knowledge base and keep it per-tenant — never share
   one KB across clinics.
