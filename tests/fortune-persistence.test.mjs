import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import * as contract from "../lib/daily-fortune-contract.ts";

test("운세 설정과 당일 결과는 계정에 저장되며 재방문은 생성 한도를 쓰지 않음", async () => {
  const saved = new Map(); let user = "member-a", date = "2026-09-22", generated = 0, claimed = 0;
  const modules = {
    "node:crypto": crypto,
    "@google/genai": { Type: {}, GoogleGenAI: class { models = { generateContent: async () => { generated++; return { text: JSON.stringify(contract.SAFE_DAILY_FORTUNE_FALLBACK) }; } }; } },
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status, cookies: { set() {} } }) } },
    "@/lib/daily-fortune-contract": contract,
    "@/lib/admin-data": { getServiceClient: () => ({ rpc: async () => { claimed++; return { data: true }; } }) },
    "@/lib/personal-member-context": { resolvePersonalKakaoIdentity: async () => user ? { ok: true, authUserId: user } : { ok: false } },
    "@/lib/request-security": { guardMutationRequest: () => null, readLimitedJson: async request => ({ ok: true, value: request.body }) },
    "@/lib/run-records": { toKstIsoDate: () => date },
    "@/lib/server-error-log": { logServerFailure() {} },
    "@/lib/fortune-storage": { fortuneStorage: async (_, id) => ({ read: async key => saved.get(`${id}/${key}`) ?? null, write: async (key, value) => saved.set(`${id}/${key}`, value) }) },
  };
  const code = ts.transpileModule(readFileSync(new URL("../app/api/me/fortune/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", "process", code)(name => { assert.ok(modules[name], name); return modules[name]; }, exports, { env: { GEMINI_API_KEY: "test-only" } });
  const profile = { name: "테스트", birth_date: "1990-01-01", birth_time: "07:00", residence: "seoul" };
  const request = { body: profile, cookies: { get() {} } };
  assert.equal((await exports.GET()).body.profile, null);
  assert.equal((await exports.POST(request)).status, 200);
  const restored = (await exports.GET()).body;
  assert.deepEqual(restored.profile, profile);
  assert.equal(restored.result.date, date);
  assert.deepEqual(restored.result.fortune, contract.SAFE_DAILY_FORTUNE_FALLBACK);
  assert.equal((await exports.POST(request)).status, 200);
  assert.equal(generated, 1); assert.equal(claimed, 1);
  user = "member-b"; assert.equal((await exports.GET()).body.profile, null);
  user = "member-a"; date = "2026-09-23";
  assert.equal((await exports.GET()).body.result, null);
  assert.equal((await exports.POST(request)).body.date, date);
  assert.equal(generated, 2); assert.equal(claimed, 2);
  user = null; assert.equal((await exports.GET()).status, 401); assert.equal((await exports.POST(request)).status, 401);
});
