# Migration history — reconciliation notes

This directory was reconstructed on **2026-07-22** to close the gap flagged in
`HANDOFF.md`: the live schema had been applied ad-hoc from `database/*.sql`, so the
repo carried **no `supabase/migrations/` history at all**.

Live project ref: `gldxvazsoqxyfuxeursn`.

## What's here

| File | Provenance |
| :-- | :-- |
| `20260609000000_baseline_leads_agency.sql` | **RECONSTRUCTED** by introspecting the live DB, then registered in the tracking table. See the safety note below. |
| `20260610221716_add_source_to_leads.sql` | Mirrored byte-for-byte from the live tracking table |
| `20260615224801_create_enterprise_leads.sql` | Mirrored byte-for-byte |
| `20260723033022_tenant_isolation.sql` | Mirrored byte-for-byte |
| `20260723033033_appointments.sql` | Mirrored byte-for-byte |
| `20260723033041_appointments_reminders.sql` | Mirrored byte-for-byte |
| `20260723035559_web_leads.sql` | Mirrored byte-for-byte |
| `20260723055430_harden_agency_leads_and_rls_fn.sql` | Applied 2026-07-22 via MCP, then mirrored byte-for-byte |
| `20260723060504_tenant_rls_performance.sql` | Applied 2026-07-22 via MCP, then mirrored byte-for-byte |
| `20260723080122_appointments_requested_status.sql` | Applied 2026-07-23 via MCP, then mirrored byte-for-byte. Adds the `'requested'` appointment state: the AI can only ever record a *request*, and only a human at the clinic promotes it to `'confirmed'` — which is what makes a row eligible for an outbound reminder call. Before it, `status` defaulted to `'confirmed'`, so a request the patient was told was unconfirmed was indistinguishable from a real booking. |

All **ten** files were verified by MD5 against
`supabase_migrations.schema_migrations` (trailing-newline normalised) — all ten match
exactly, so repo and tracking table are fully consistent. The nine mirrored ones are
intentionally **unmodified** (no added header comments), so you can re-run that diff
at any time.

> If you add a migration, keep that property: apply it, then mirror the stored
> statement back into the file verbatim. Explanatory prose belongs in the
> provenance table above, **not** in a header comment — a header makes the file
> diverge from the tracking table and silently breaks the MD5 check for whoever
> runs it next. (Learned by doing exactly that on 2026-07-23.)

Replaying the full chain reproduces the live schema **exactly** — verified
empirically, not by inspection. See [Verifying the replay](#verifying-the-replay) for
the repeatable procedure and its result (zero differences).

> Caught during review: the first cut of the baseline **omitted the two `leads`
> indexes** (`leads_created_at_idx`, `leads_clinic_name_idx`), which exist live but
> are created by no tracked migration. They are in the baseline now. If you extend
> this history, diff `pg_indexes` and `pg_constraint` against live — the tracking
> table alone will not tell you about objects created outside a migration.

## The baseline is safe to run — and this was NOT always true

`supabase db push` is now safe against the live project. It was not, and the fix is
worth understanding before anyone "restores" the old version of this file.

**The hazard that existed:** the baseline originally recreated the two pre-tenancy
permissive policies (`"Allow authenticated access"` on `leads`, and
`"Allow authenticated access to agency leads"` on `agency_leads`), because that was
historically faithful. Those are dropped by `20260723033022_tenant_isolation` and
`20260723055430_harden_agency_leads_and_rls_fn` respectively — but **those two were
already recorded as applied**, while the baseline was not. So `supabase db push`
against live would have applied *only* the baseline, recreated both permissive
policies, and had nothing left to drop them again — **silently re-opening
cross-tenant lead reads and re-exposing the B2B pipeline.**

**Two independent fixes, both applied:**

1. **The baseline no longer creates any permissive policy.** Since the later
   migrations drop them with `DROP POLICY IF EXISTS`, omitting them is *end-state
   identical* on a fresh replay (verified — zero diff) while making the file
   incapable of weakening RLS anywhere. The only policy it still creates is the
   `service_role` one, which matches live exactly and grants nothing to a client role.
2. **The baseline is now registered** in `supabase_migrations.schema_migrations`
   (version `20260609000000`), so `db push` treats it as applied and skips it.

Fix 1 is the load-bearing one: even if the tracking row were lost, running the file
could no longer cause a security regression. Fix 2 means it won't run at all.

> If you ever edit this file, re-check that it creates no policy granting anything to
> `anon` or `authenticated`. That is the invariant that makes it safe.

## Why the baseline exists

`public.leads` (plus the enum types `procedure_interest_enum` / `language_enum`) and
`public.agency_leads` were created before migration tracking began, so no recorded
migration covers them. Without the baseline, `20260610221716_add_source_to_leads`
would `ALTER` a table that doesn't exist and a fresh `supabase db push` would fail.

It also captures the `service_role_all` policy on `leads`, which is present live but
absent from every tracked migration.

## Adopting the CLI workflow against the *live* project

All nine filenames match versions recorded in the live tracking table, so the CLI
treats every one as already applied:

```bash
supabase db push --project-ref gldxvazsoqxyfuxeursn   # no-op against live
```

No `supabase migration repair` step is needed — the baseline was registered directly.
(Earlier revisions of this file told you to run `repair` instead of `db push`; that
instruction is obsolete, and `db push` is now the safe default.)

## Verifying the replay

Run on 2026-07-22 against project `gldxvazsoqxyfuxeursn`: **zero differences.**

There is no Docker or `psql` on the dev box, so `supabase db reset` (which needs a
local stack) is unavailable, and a Supabase branch bills. The free equivalent is to
replay the chain into a throwaway schema on the same instance and diff it against
`public`:

1. `create schema mig_verify;`
2. Concatenate the migrations in filename order, rewriting `public.` → `mig_verify.`
   and `nspname = 'public'` → `nspname = 'mig_verify'` (that literal appears in the
   baseline's enum-existence guard — miss it and the enums resolve to the wrong
   schema and the table create fails).
   Omit the `REVOKE`s in `20260723055430`: they target `public.rls_auto_enable()`,
   which is a grant rather than schema shape.
3. Diff `mig_verify` against `public` with `EXCEPT` in both directions over
   `information_schema.columns` (name, ordinal, type, nullability, default),
   `pg_indexes`, `pg_constraint` (via `pg_get_constraintdef`), `pg_policies`
   (name, cmd, roles, `qual`, `with_check`), and `pg_class.relrowsecurity` —
   normalising schema names out of the generated text.
4. `drop schema mig_verify cascade;`

The schema is not in the API's exposed-schema list, so it is never reachable over
PostgREST while it exists.

### Exactly what the diff covers

Compared: columns (name, ordinal, type, nullability, default), indexes, constraints
(PK / unique / FK incl. delete rules / check), policies (name, command, roles,
`USING`, `WITH CHECK`), and `relrowsecurity`.

**Not** compared by the automated diff, checked separately by hand instead:

- **Comments.** Live has exactly two — the `leads.source` column comment and the
  `web_leads` table comment. Both are created by migrations and match textually.
- **Table grants.** All seven tables carry identical Supabase *default* privileges
  (`anon`, `authenticated`, `service_role` each hold full `arwdDxtm`), which the
  platform applies to anything created in `public`. No migration needs to grant
  them, and a fresh project gets the same. ⚠️ Note what this means: **RLS is the
  only thing keeping `anon`/`authenticated` out of these tables** — the table
  grants themselves are wide open. Never ship a table here without a policy.
- **Database-level objects** — see below.

Caveat: this validates the **resulting shape**, not Supabase's migration runner. It
would not catch a problem that only manifests through `supabase db push` itself.

## Live objects deliberately outside this history

The event trigger **`ensure_rls`** (firing `public.rls_auto_enable()` on
`ddl_command_end`, which auto-enables RLS on new `public` tables) exists on the live
database but is **not** reproduced by any migration. A fresh project built from these
files will not have it.

That is intentional: `CREATE EVENT TRIGGER` needs privileges beyond what a normal
migration should assume, and the trigger is **not load-bearing here** — every
migration in this directory enables RLS explicitly on every table it creates, so the
safety net is never the thing doing the work.

If you rebuild on a fresh project, either recreate it out-of-band or simply keep
enabling RLS explicitly, as these migrations already do.

> Confirmed still working after `20260723055430` revoked `EXECUTE` from
> `anon`/`authenticated`: the replay's `CREATE TABLE`s fired the trigger with no
> error. Revoking RPC access does not affect event-trigger invocation.

## Rolling back the hardening migration

`20260723055430_harden_agency_leads_and_rls_fn` made two live security changes. Both
are reversible, though reversing either re-opens the hole it closed:

```sql
-- 1. Restore the permissive agency_leads policy.
--    NOT recommended: this is what let any signed-in user read/write the B2B pipeline.
CREATE POLICY "Allow authenticated access to agency leads" ON public.agency_leads
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Restore EXECUTE on the event-trigger function.
--    NOT recommended: re-exposes it via /rest/v1/rpc/rls_auto_enable.
--    It originally had no explicit ACL, so PUBLIC held EXECUTE by default.
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC;
```

Neither change touches data, and `service_role` (which every Edge Function uses)
retained `EXECUTE` throughout, so ingestion was never affected.

## Not covered by migrations (deliberately)

- **`pg_cron` / `pg_net` + the `reminder-dispatch-20min` job.** The scheduled job
  command embeds `CRON_SECRET`, so it is provisioned out-of-band and kept out of
  version control. See `HANDOFF.md` §0.
- **Edge Function config** lives in `supabase/config.toml`, not here. It previously
  declared `verify_jwt = true` for `vapi-webhook` and omitted the other two
  functions entirely — a CLI deploy would have flipped live from `false` to `true`
  and 401'd every call. Fixed 2026-07-22: all three are now explicitly
  `verify_jwt = false`, matching live.

## Known-accepted advisor warnings

Exact counts, so nobody has to re-derive them:

- **Security: 4 WARN → 1 WARN.** Fixed the permissive `agency_leads` policy and both
  `SECURITY DEFINER` RPC exposures. The 1 remaining is `pg_net`, accepted below.
  3 INFO remain (`rls_enabled_no_policy` on `agency_leads`, `clinic_staff`,
  `web_leads`) — all intentional service-role-only tables.
- **Performance: 4 WARN → 0 WARN.** Fixed all four `auth_rls_initplan` policies and
  all four unindexed FKs. Only `unused_index` INFO remains, accepted below.

The two accepted items:

- **`pg_net` is installed in the `public` schema** (lint `0014_extension_in_public`).
  Not moved: the `reminder-dispatch-20min` `pg_cron` job calls `net.http_post`, and
  relocating the extension risks breaking the reminder loop for a lint-level warning.
  Revisit only alongside a tested rebuild of the cron job.
- **`unused_index` on every non-constraint index** (lint `0005_unused_index`;
  PK/unique indexes are not flagged). Expected and ignored:
  all tables currently hold zero rows, so no index has been used *yet*. These are
  pre-created for the access patterns the app actually has. **Do not drop them** on
  the strength of this lint until there is real traffic to judge against.

## Relationship to `database/*.sql`

`database/*.sql` were the working scratch files used to apply the live schema. This
directory is now the canonical history. **See `database/README.md` — do not run
anything in there.**

Two of those files are actively dangerous: `enterprise_leads_schema.sql` and
`agency_leads_schema.sql` each `CREATE POLICY ... USING (true) WITH CHECK (true)` for
`authenticated`. Postgres ORs permissive policies together, so running either against
the live DB adds blanket access *alongside* the per-clinic policy and **silently
defeats tenant isolation** — on `enterprise_leads` that exposes health-adjacent PII.
Their `CREATE TABLE IF NOT EXISTS` guards protect the table, not the policy.

`database/supabase_schema.sql` is separately **drifted from production** (`TEXT CHECK`
columns where live uses real enums, a UTC `created_at` default, a `NOT NULL` `call_id`,
and missing `clinic_name` / `notes`). Trust these migrations over all of it.
