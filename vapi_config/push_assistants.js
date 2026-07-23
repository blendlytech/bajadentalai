#!/usr/bin/env node
// Push the repo's Vapi config to the live assistants. The repo is the source of
// truth; this script makes it so.
//
//   node vapi_config/push_assistants.js
//
// Reads VAPI_PRIVATE_KEY from .env. Idempotent: tools are looked up by name and
// reused, and every PATCH sends the FULL model object.
//
// ⚠️ THE TRAP (learned the hard way, 2026-07-23): PATCH /assistant REPLACES the
// whole `model` object — it does not merge. Sending `{model:{knowledgeBase:…}}`
// to update just the KB silently wipes `messages` (the entire system prompt) and
// `toolIds`. Always spread the live model and modify fields on the copy, which
// is what this script does. Never hand-roll a partial model PATCH.
//
// What it pushes:
//   tools     <- vapi_config/tools_schema.json         (created if absent)
//   KB file   <- docs/dental_tourism_knowledge_base.txt (uploaded if changed)
//   Sofía     <- vapi_config/system_prompt.txt + tools + KB + webhook
//   Mateo/B2B <- vapi_config/b2b_system_prompt.txt + webhook + campaign_type
//                metadata + vapi_config/b2b_structured_schema.json
//
// The B2B assistant's `metadata.campaign_type` and `server.url` are load-bearing:
// without both, vapi-webhook's `b2b_agency` branch never fires and every B2B
// lead is silently dropped.

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const WEBHOOK = "https://gldxvazsoqxyfuxeursn.supabase.co/functions/v1/vapi-webhook";
const DEMO_ID = "01ff55d9-1977-4987-abcc-8ee8d4c2690f"; // "Dental_Demo" (Sofía, inbound)
const B2B_ID = "fd7c0e0a-3ca1-47b7-b738-6481b647005f"; // "Baja Dental B2B Assistant" (Mateo)
const KB_PATH = "docs/dental_tourism_knowledge_base.txt";

function vapiKey() {
  if (process.env.VAPI_PRIVATE_KEY) return process.env.VAPI_PRIVATE_KEY;
  const env = fs.readFileSync(path.join(REPO, ".env"), "utf8");
  const m = env.match(/^VAPI_PRIVATE_KEY=(.*)$/m);
  if (!m) throw new Error("VAPI_PRIVATE_KEY not found in environment or .env");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const KEY = vapiKey();
const read = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const readJson = (p) => JSON.parse(read(p));

async function api(method, url, body) {
  const res = await fetch(`https://api.vapi.ai${url}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 600)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function uploadKb() {
  const local = fs.readFileSync(path.join(REPO, KB_PATH));
  const files = await api("GET", "/file");
  const name = path.basename(KB_PATH);
  // Vapi returns `bytes` as a STRING — coerce, or this never matches and every
  // run uploads a duplicate KB.
  const match = (Array.isArray(files) ? files : []).find(
    (f) => f.name === name && Number(f.bytes) === local.length,
  );
  if (match) {
    console.log(`kb    ${name}: unchanged (${match.id})`);
    return match.id;
  }
  const form = new FormData();
  // Explicit MIME type required — Vapi rejects application/octet-stream.
  form.append("file", new Blob([local], { type: "text/plain" }), name);
  const res = await fetch("https://api.vapi.ai/file", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`file upload -> ${res.status}: ${await res.text()}`);
  const created = await res.json();
  console.log(`kb    ${name}: UPLOADED ${created.id} (${created.bytes}b)`);
  return created.id;
}

(async () => {
  // --- tools ---------------------------------------------------------------
  const existing = await api("GET", "/tool");
  const byName = new Map(
    (Array.isArray(existing) ? existing : []).map((t) => [t.function && t.function.name, t.id]),
  );
  const toolIds = [];
  for (const spec of readJson("vapi_config/tools_schema.json")) {
    const name = spec.function.name;
    if (byName.has(name)) {
      console.log(`tool  ${name}: exists (${byName.get(name)})`);
      toolIds.push(byName.get(name));
    } else {
      const created = await api("POST", "/tool", spec);
      console.log(`tool  ${name}: CREATED ${created.id}`);
      toolIds.push(created.id);
    }
  }

  const kbFileId = await uploadKb();

  // --- Sofía (inbound patient assistant) -----------------------------------
  const demo = await api("GET", `/assistant/${DEMO_ID}`);
  const demoModel = { ...demo.model }; // full object — see THE TRAP above
  delete demoModel.tools;
  demoModel.messages = [{ role: "system", content: read("vapi_config/system_prompt.txt") }];
  demoModel.toolIds = toolIds;
  demoModel.knowledgeBase = { provider: "google", fileIds: [kbFileId] };

  await api("PATCH", `/assistant/${DEMO_ID}`, {
    model: demoModel,
    server: { url: WEBHOOK },
    serverMessages: ["end-of-call-report"],
  });
  console.log(`\nSofía  (${DEMO_ID}): prompt + ${toolIds.length} tools + KB pushed`);

  // --- Mateo (B2B outbound/inbound sales assistant) ------------------------
  const b2b = await api("GET", `/assistant/${B2B_ID}`);
  const b2bModel = { ...b2b.model };
  delete b2bModel.tools;
  b2bModel.messages = [{ role: "system", content: read("vapi_config/b2b_system_prompt.txt") }];

  await api("PATCH", `/assistant/${B2B_ID}`, {
    model: b2bModel,
    server: { url: WEBHOOK },
    serverMessages: ["end-of-call-report"],
    metadata: { campaign_type: "b2b_agency" },
    analysisPlan: {
      ...(b2b.analysisPlan || {}),
      structuredDataPlan: {
        enabled: true,
        schema: readJson("vapi_config/b2b_structured_schema.json"),
      },
    },
  });
  console.log(`Mateo  (${B2B_ID}): prompt + webhook + campaign_type + schema pushed`);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
