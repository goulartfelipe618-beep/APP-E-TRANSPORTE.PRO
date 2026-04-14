/**
 * Varredura estática de ficheiros em src/ alcançáveis por imports.
 * Raízes produção: main.tsx, App.tsx
 * Raízes teste: ficheiros .test / .spec em src
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

/** @param {string} dir */
function walkTs(dir, { testsOnly = false } = {}) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walkTs(p, { testsOnly }));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(e.name)) continue;
    const isTest = /\.(test|spec)\.(ts|tsx)$/.test(e.name);
    if (testsOnly && !isTest) continue;
    if (!testsOnly && isTest) continue;
    out.push(path.resolve(p));
  }
  return out;
}

/** @param {string} dir */
function walkTestFiles(dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walkTestFiles(p));
      continue;
    }
    if (/\.(test|spec)\.(ts|tsx)$/.test(e.name)) out.push(path.resolve(p));
  }
  return out;
}

/** @param {string} p */
function read(p) {
  return fs.readFileSync(p, "utf8");
}

/**
 * @param {string} fromAbs
 * @param {string} spec
 */
function resolveImport(fromAbs, spec) {
  if (spec.startsWith("node:") || spec.startsWith("vite") || spec.startsWith("@vitejs")) return null;
  if (!spec.startsWith(".") && !spec.startsWith("@/")) return null;

  if (spec.startsWith("@/")) {
    const rel = spec.slice(2);
    const base = path.join(SRC, rel);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ];
    for (const c of candidates) {
      try {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
      } catch {
        /* empty */
      }
    }
    return null;
  }

  const dir = path.dirname(fromAbs);
  const base = path.resolve(dir, spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
    } catch {
      /* empty */
    }
  }
  return null;
}

/**
 * @param {string} content
 * @param {string} fromAbs
 */
function collectResolvedImports(content, fromAbs) {
  /** @type {Set<string>} */
  const resolved = new Set();

  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+[^;]*?from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]\s*;/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const r = resolveImport(fromAbs, m[1]);
      if (r && r.startsWith(path.resolve(SRC))) resolved.add(r);
    }
  }

  return [...resolved];
}

/**
 * @param {string[]} startAbs
 */
function reachableFrom(startAbs) {
  /** @type {Set<string>} */
  const visited = new Set();
  const queue = [...startAbs].map((p) => path.resolve(p));

  while (queue.length) {
    const f = queue.pop();
    if (!f || visited.has(f)) continue;
    if (!f.startsWith(path.resolve(SRC))) continue;
    if (!/\.(ts|tsx)$/.test(f)) continue;
    if (!fs.existsSync(f)) continue;
    visited.add(f);
    let content;
    try {
      content = read(f);
    } catch {
      continue;
    }
    for (const next of collectResolvedImports(content, f)) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

const prodRoots = [path.join(SRC, "main.tsx"), path.join(SRC, "App.tsx")].map((p) => path.resolve(p));
const testRoots = walkTestFiles(SRC);

const prodReach = reachableFrom(prodRoots);
const appAndTestsReach = reachableFrom([...prodRoots, ...testRoots]);

const allNonTestSrc = walkTs(SRC, { testsOnly: false });

const toolingKeep = new Set(
  [path.join(SRC, "vite-env.d.ts"), path.join(SRC, "test", "setup.ts")].map((p) => path.resolve(p)),
);

const deadRaw = allNonTestSrc.filter((f) => !appAndTestsReach.has(path.resolve(f)));
const deadEverywhere = deadRaw.filter((f) => !toolingKeep.has(path.resolve(f)));
const toolingNotInImportGraph = deadRaw.filter((f) => toolingKeep.has(path.resolve(f)));
const testOnly = allNonTestSrc.filter((f) => !prodReach.has(path.resolve(f)) && appAndTestsReach.has(path.resolve(f)));

function rel(f) {
  return path.relative(ROOT, f).split(path.sep).join("/");
}

console.log(
  JSON.stringify(
    {
      deadEverywhere: deadEverywhere.map(rel),
      toolingNotInImportGraph: toolingNotInImportGraph.map(rel),
      testOnly: testOnly.map(rel),
    },
    null,
    2,
  ),
);
