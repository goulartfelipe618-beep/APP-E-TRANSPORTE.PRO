/**
 * Imprime JSON no stdout para deploy via MCP `deploy_edge_function`.
 * Uso: node scripts/build-mcp-stripe-deploy.mjs checkout | webhook
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sharedPath = path.join(root, "supabase/functions/_shared/stripePlanPrices.ts");
const shared = fs.readFileSync(sharedPath, "utf8");

const which = process.argv[2] || "checkout";
const name =
  which === "webhook" ? "stripe-webhook" : "stripe-create-checkout-session";
const folder =
  which === "webhook"
    ? "supabase/functions/stripe-webhook/index.ts"
    : "supabase/functions/stripe-create-checkout-session/index.ts";
let idx = fs.readFileSync(path.join(root, folder), "utf8");
idx = idx.replaceAll("../_shared/stripePlanPrices.ts", "./_shared/stripePlanPrices.ts");

const payload = {
  project_id: "lsfwmbpvithxqerfdlhy",
  name,
  entrypoint_path: "index.ts",
  verify_jwt: which !== "webhook",
  files: [
    { name: "index.ts", content: idx },
    { name: "_shared/stripePlanPrices.ts", content: shared },
  ],
};

const outName = process.argv[3] || "";
if (outName) {
  const outPath = path.join(root, outName);
  fs.writeFileSync(outPath, JSON.stringify(payload), "utf8");
  process.stderr.write(`Wrote ${outPath} (${fs.statSync(outPath).size} bytes)\n`);
} else {
  process.stdout.write(JSON.stringify(payload));
}
