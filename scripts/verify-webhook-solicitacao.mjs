/**
 * Verifica POST à Edge Function webhook-solicitacao (motorista FREE).
 * Uso: na raiz do repo, com .env preenchido:
 *   npm run verify:webhook-solicitacao
 *
 * Variáveis: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 * Opcional: WEBHOOK_TEST_AUTOMACAO_ID (default = UUID automação parceiro linkada ao repo)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const baseUrl = (process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const automacaoId =
  process.env.WEBHOOK_TEST_AUTOMACAO_ID || "d583fbea-960d-4178-94c8-50d3941ef532";

if (!baseUrl || !anon) {
  console.error("Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY no .env");
  process.exit(1);
}

const email = `verify-webhook-${Date.now()}@example.invalid`;
const body = {
  nome: "Felipe Goulart",
  email,
  telefone: "5547988336609",
};

const url = `${baseUrl}/functions/v1/webhook-solicitacao?automacao_id=${encodeURIComponent(automacaoId)}`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

console.log("HTTP", res.status);
console.log(JSON.stringify(json, null, 2));

if (!res.ok) {
  process.exit(1);
}
