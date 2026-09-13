// Explicit, one-off release operation. Credentials stay in Vercel's build
// environment. Only the configured operator's 4th-season encouragements change.
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";

const mode = process.env.TWTT_QUOTES_MODE;
if (!mode) process.exit(0);
if (!["audit", "apply"].includes(mode)) throw new Error("Invalid quote release mode.");
const { createClient } = await import("@supabase/supabase-js");
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) throw new Error("Quote release configuration is missing.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const catalog = JSON.parse(readFileSync(new URL("../lib/encouragement-quotes.json", import.meta.url), "utf8"));
const messages = catalog.quotes.map(q => `${q.text} — ${q.author}`);
if (messages.length !== 50 || new Set(messages).size !== 50 || messages.some(m => m.length > 120)) throw new Error("Expected exactly 50 distinct, bounded quotes.");
let owner = process.env.ADMIN_USER_ID || process.env.SUPABASE_ADMIN_USER_ID;
if (!owner) {
  const config = readFileSync(new URL("../lib/admin.ts", import.meta.url), "utf8");
  const email = config.match(/ADMIN_EMAIL = "([^"]+)"/)?.[1];
  if (!email) throw new Error("Configured operator not found.");
  for (let page = 1; page <= 20 && !owner; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("Cannot resolve operator.");
    owner = data.users.find(user => user.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 100) break;
  }
}
if (!owner || !/^[0-9a-f-]{36}$/i.test(owner)) throw new Error("A single configured operator is required.");
const table = "hello_2027_encouragements";
const columns = "id,user_id,season_key,message,display_order,active,created_at,updated_at";
async function readRows() {
  const { data, error } = await db.from(table).select(columns).eq("user_id", owner).eq("season_key", "4th").order("id");
  if (error || !data || data.length > 56) throw new Error("Quote scope check failed.");
  return data;
}
const hash = rows => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
const original = await readRows();
const alreadyApplied = original.length === 50 && original.every(r => r.active && messages[r.display_order] === r.message);
console.info(`Quote audit: season=4th, rows=${original.length}, active=${original.filter(r => r.active).length}, sha256=${hash(original)}, target=50, alreadyApplied=${alreadyApplied}.`);
if (mode === "audit" || alreadyApplied) process.exit(0);
if (!process.env.TWTT_QUOTES_EXPECTED_SHA || hash(original) !== process.env.TWTT_QUOTES_EXPECTED_SHA) throw new Error("Quote snapshot changed; audit again before applying.");

const bucket = "member-run-uploads";
const storage = await db.storage.getBucket(bucket);
if (storage.error || storage.data.public) throw new Error("Private backup storage is required before replacement.");
const backupPath = `release-backups/${catalog.version}-${randomUUID()}.json`;
const backup = await db.storage.from(bucket).upload(backupPath, JSON.stringify({ version: catalog.version, table, season: "4th", original }), { contentType: "application/json", upsert: false });
if (backup.error) throw new Error("Quote backup failed; no content was changed.");
console.info(`Quote recovery backup: ${bucket}/${backupPath}`);
if (hash(await readRows()) !== hash(original)) throw new Error("Quote snapshot changed after backup; no content was changed.");

const stamp = new Date().toISOString();
const rows = messages.map((message, index) => ({
  id: original[index]?.id ?? randomUUID(), user_id: owner, season_key: "4th",
  message, display_order: index, active: true,
  created_at: original[index]?.created_at ?? stamp, updated_at: stamp,
}));
// Reuse existing IDs so the 56-row DB limit is respected even during replacement.
// One upsert atomically replaces the 50 target rows. Extras are exact-ID scoped.
const saved = await db.from(table).upsert(rows, { onConflict: "id" });
if (saved.error) throw new Error("Quote replacement failed; retained private backup for recovery.");
const extras = original.slice(50);
for (const row of extras) {
  const deleted = await db.from(table).delete().eq("user_id", owner).eq("season_key", "4th").eq("id", row.id).eq("updated_at", row.updated_at).select("id");
  if (deleted.error || deleted.data?.length !== 1) throw new Error("Quote cleanup conflict; stop promotion and inspect the recovery backup.");
}
const final = await readRows();
if (final.length !== 50 || final.some(r => !r.active || messages[r.display_order] !== r.message)) throw new Error("Quote verification failed; stop promotion and inspect the recovery backup.");
console.info(`Quote release PASS: 50 active sourced quotes; replaced ${original.length} previous messages; other tables/seasons untouched.`);
