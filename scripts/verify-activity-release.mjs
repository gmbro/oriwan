// Opt-in production build gate. Uses credentials only inside the deployment
// environment, never downloads/prints them. No member records are modified.
if (process.env.TWTT_VERIFY_MEMBER_UPLOAD !== "1") process.exit(0);
const { createClient } = await import("@supabase/supabase-js");
const { default: sharp } = await import("sharp");
const { readFileSync } = await import("node:fs");
const { default: ts } = await import("typescript");
const { randomUUID } = await import("node:crypto");
const source = readFileSync(new URL("../lib/gemini.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('from "@google/genai"', `from ${JSON.stringify(import.meta.resolve("@google/genai"))}`);
const { GEMINI_OCR_MODEL, getMemberGeminiOcrConfig, buildMemberRunImagePrompt, getGeminiErrorDebug } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { GoogleGenAI } = await import("@google/genai");
const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey, GEMINI_API_KEY: apiKey } = process.env;
if (!url || !anonKey || !serviceKey || !apiKey) throw new Error("Release gate: required server configuration is missing.");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = "member-run-uploads";
let result = await admin.storage.getBucket(bucket);
if (result.error && (String(result.error.statusCode) === "404" || /not found/i.test(result.error.message))) {
  const created = await admin.storage.createBucket(bucket, { public: false, fileSizeLimit: 4194304, allowedMimeTypes: ["image/webp", "application/json"] });
  if (created.error && !/already exists|duplicate/i.test(created.error.message)) throw new Error("Release gate: cannot prepare private upload storage.");
  result = await admin.storage.getBucket(bucket);
}
if (result.error || !result.data || result.data.public) throw new Error("Release gate: upload bucket must be private.");
const path = `release-checks/${randomUUID()}.json`;
try {
  const upload = await admin.storage.from(bucket).upload(path, JSON.stringify({ kind: "release-permission-test" }), { contentType: "application/json", upsert: false });
  if (upload.error) throw new Error("Release gate: private upload failed.");
  const ownerRead = await admin.storage.from(bucket).download(path);
  const anonymousRead = await anon.storage.from(bucket).download(path);
  const anonymousSign = await anon.storage.from(bucket).createSignedUrl(path, 60);
  const anonymousWrite = await anon.storage.from(bucket).upload(`${path}.denied.json`, "{}", { contentType: "application/json" });
  if (!anonymousWrite.error) await admin.storage.from(bucket).remove([`${path}.denied.json`]);
  if (ownerRead.error || !anonymousRead.error || !anonymousSign.error || !anonymousWrite.error) throw new Error("Release gate: private storage authorization check failed.");
  const schema = await admin.from("daily_run_records").select("id, participant_id, user_id, season_key, image_url, status, raw_extracted_text, confidence_score").limit(0);
  if (schema.error) throw new Error("Release gate: run record schema unavailable.");
  console.info("Release gate: private storage read/write and anonymous denial PASS; record schema PASS.");
} finally {
  const cleanup = await admin.storage.from(bucket).remove([path]);
  if (cleanup.error) throw new Error("Release gate: temporary permission-test cleanup failed.");
}
const image = await sharp(Buffer.from(`<svg width="800" height="700" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="700" fill="white"/><g fill="#191f28" font-family="sans-serif"><text x="60" y="100" font-size="34">RUNNING ACTIVITY</text><text x="60" y="190" font-size="30">2026-09-08</text><text x="60" y="300" font-size="46">Distance 5.20 km</text><text x="60" y="410" font-size="46">Duration 32:10</text><text x="60" y="520" font-size="28">Average pace 6:11 /km</text><text x="60" y="610" font-size="30">Start 07:35 AM</text></g></svg>`)).webp({ quality: 90 }).toBuffer();
try {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 35_000, retryOptions: { attempts: 1 } } });
  const response = await ai.models.generateContent({ model: GEMINI_OCR_MODEL, config: getMemberGeminiOcrConfig(), contents: [{ role: "user", parts: [{ text: buildMemberRunImagePrompt() }, { inlineData: { mimeType: "image/webp", data: image.toString("base64") } }] }] });
  const value = JSON.parse(response.text || "{}");
  if (value.activity_time !== "07:35" || value.activity_date !== "2026-09-08" || value.record_date !== "2026-09-08" || Number(value.distance_km) !== 5.2 || Number(value.duration_seconds) !== 1930) {
    console.info("Release gate: synthetic fixture mismatch", { date: value.record_date, distance: value.distance_km, seconds: value.duration_seconds });
    throw new Error("fixture_mismatch");
  }
  console.info(`Release gate: ${GEMINI_OCR_MODEL} live image OCR PASS (date, 5.20 km, 32:10). Tokens: input=${response.usageMetadata?.promptTokenCount}, output=${response.usageMetadata?.candidatesTokenCount}, thoughts=${response.usageMetadata?.thoughtsTokenCount ?? 0}.`);
} catch (error) {
  console.info("Release gate: safe OCR diagnostic category", getGeminiErrorDebug(error));
  // Provider error payloads may include request details: do not print them.
  throw new Error("Release gate: cheapest OCR live image check failed; do not promote this deployment.");
}
