# `database/` — historical scratch SQL, do not apply

**The canonical schema lives in [`supabase/migrations/`](../supabase/migrations/).**

These files are the ad-hoc scripts originally pasted into the Supabase SQL editor to
build the live schema. They are kept for history only.

Every object in the **live** database is reproduced by a tracked migration, verified
by an actual replay-and-diff. The reverse does not hold: these files are not all
faithful to live — `supabase_schema.sql` in particular describes a `leads` table that
no longer exists in that form.

## ⚠️ Two of these files will silently break tenant isolation if you run them

Postgres **ORs permissive RLS policies together**. Both files below create a
`USING (true) WITH CHECK (true)` policy for the `authenticated` role. Running either
one against the live database *adds* that policy alongside the per-clinic policy — and
the result is that **any signed-in user can read every row**, defeating multi-tenancy
entirely.

| File | Hazard |
| :-- | :-- |
| `enterprise_leads_schema.sql` | Recreates `"Allow authenticated access"` on `enterprise_leads` — the **health-adjacent PII** table (pain points, transcripts, recording URLs). Worst case in the repo. |
| `agency_leads_schema.sql` | Recreates `"Allow authenticated access to agency leads"`, re-opening the B2B pipeline that migration `20260723055430` deliberately closed. |

The `CREATE TABLE IF NOT EXISTS` at the top makes these look safe to re-run. They are
not — the guard covers the table, not the policy.

## The rest

| File | Status |
| :-- | :-- |
| `supabase_schema.sql` | **Drifted from production.** Wrong column types (`TEXT CHECK` vs real enums), wrong `created_at` default, wrong `call_id` nullability, missing columns. |
| `tenant_isolation_schema.sql` | Superseded by `20260723033022`. Re-running errors on `CREATE POLICY` (already exists) — noisy, not dangerous. |
| `appointments_schema.sql` | Superseded by `20260723033033`. Same: errors, not dangerous. |
| `appointments_reminders_schema.sql` | Superseded by `20260723033041`. |
| `web_leads_schema.sql` | Superseded by `20260723035559`. |

## If you need to rebuild the schema

Use the migrations, not this directory:

```bash
supabase db push --project-ref gldxvazsoqxyfuxeursn
```

That is a no-op against the live project: all nine migrations are recorded as applied,
and the baseline is written so it cannot weaken RLS even if it does run. See
`supabase/migrations/README.md` → "The baseline is safe to run" for why that property
matters and how to preserve it.
