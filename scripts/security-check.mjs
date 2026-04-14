#!/usr/bin/env node
/**
 * npm run security-check
 * — npm audit (moderate+)
 * — alerta se ficheiros .env* perigosos aparecerem fora do padrão seguro na raiz
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  "playwright-report",
  "test-results",
]);

function walkEnvFiles(dir, rel = "", depth = 0, out = []) {
  if (depth > 6) return out;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const name = ent.name;
    const relPath = rel ? `${rel}/${name}` : name;
    const full = path.join(dir, name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      walkEnvFiles(full, relPath, depth + 1, out);
      continue;
    }
    if (!name.startsWith(".env")) continue;
    if (name === ".env.example") continue;
    // Raiz: .env / .env.local são esperados em desenvolvimento local.
    if (relPath.replace(/\\/g, "/") === ".env" || relPath.replace(/\\/g, "/") === ".env.local") continue;
    out.push(relPath.replace(/\\/g, "/"));
  }
  return out;
}

let exit = 0;

console.log("--- npm audit (falha apenas em high/critical) ---\n");
console.log("(Vulnerabilidades moderate — ex.: Vite dev — aparecem no relatório mas não bloqueiam este script.)\n");
try {
  execSync("npm audit --audit-level=high", { cwd: root, stdio: "inherit" });
} catch {
  exit = 1;
}

console.log("\n--- Ficheiros .env (exceto .env.example) ---\n");
const envFiles = walkEnvFiles(root);
if (envFiles.length === 0) {
  console.log("Nenhum ficheiro .env* encontrado no projeto (além de .env.example).");
} else {
  console.warn("AVISO: estes ficheiros contêm segredos e não devem ir para o Git nem para o deploy por engano:");
  for (const f of envFiles) console.warn(`  - ${f}`);
  console.warn("\nConfirme que estão no .gitignore e que a Vercel usa apenas variáveis do painel.");
  exit = 1;
}

if (existsSync(path.join(root, ".env"))) {
  console.log("\nNota: existe `.env` na raiz (normal em local). Nunca faça commit deste ficheiro.");
}

try {
  const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .filter((line) => /^\.env/.test(line) && line !== ".env.example");
  if (tracked.length) {
    console.error("\nERRO CRÍTICO: ficheiros .env estão versionados no Git:");
    for (const t of tracked) console.error(`  - ${t}`);
    exit = 1;
  }
} catch {
  /* fora de repo git */
}

process.exit(exit);
