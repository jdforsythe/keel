// Generates turbo.json and .github/workflows/ci.yml from tooling/*.source.json.
// Usage: node tooling/generate.mjs [--check]   (--check exits 2 with S0007 on drift)
import fs from "node:fs";
import path from "node:path";
import { parseArgs, run } from "./output.ts";

const here = import.meta.dirname;
const root = path.join(here, "..");
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(here, f), "utf8"));

const PLAIN = /^[A-Za-z_./][A-Za-z0-9_./@ -]*$/;
const RESERVED = /^(?:true|false|null|yes|no|on|off|y|n|~)$/i;
const scalar = (v) => {
  if (typeof v === "string") return PLAIN.test(v) && !RESERVED.test(v) && !v.endsWith(" ") ? v : JSON.stringify(v);
  return JSON.stringify(v);
};
const key = (k) => (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(k) ? k : JSON.stringify(k));
const isObj = (v) => typeof v === "object" && v !== null;

/** Minimal block-style YAML emitter for JSON values. */
function yaml(v, ind = 0) {
  const pad = " ".repeat(ind);
  const out = [];
  if (Array.isArray(v)) {
    for (const item of v) {
      if (isObj(item) && !Array.isArray(item) && Object.keys(item).length) {
        const lines = yaml(item, ind + 2).split("\n");
        out.push(`${pad}- ${lines[0].slice(ind + 2)}`, ...lines.slice(1));
      } else out.push(`${pad}- ${isObj(item) ? (Array.isArray(item) ? "[]" : "{}") : scalar(item)}`);
    }
  } else {
    for (const [k, val] of Object.entries(v)) {
      if (Array.isArray(val) && val.length) out.push(`${pad}${key(k)}:`, yaml(val, ind + 2));
      else if (isObj(val) && !Array.isArray(val) && Object.keys(val).length)
        out.push(`${pad}${key(k)}:`, yaml(val, ind + 2));
      else if (isObj(val)) out.push(`${pad}${key(k)}: ${Array.isArray(val) ? "[]" : "{}"}`);
      else out.push(`${pad}${key(k)}: ${scalar(val)}`);
    }
  }
  return out.join("\n");
}

function turbo() {
  const src = readJson("turbo.source.json");
  const { $schema, ...rest } = src;
  return `// _generated: edit tooling/turbo.source.json and run pnpm generate. Do not edit by hand.\n${JSON.stringify({ ...($schema ? { $schema } : {}), ...rest }, null, 2)}\n`;
}

function ci() {
  const { setup, jobs, ...rest } = readJson("ci.source.json");
  const expanded = {};
  for (const [name, job] of Object.entries(jobs)) {
    expanded[name] = { ...job, steps: job.steps.flatMap((s) => (s === "$setup" ? setup : [s])) };
  }
  return `# _generated: edit tooling/ci.source.json and run pnpm generate. Do not edit by hand.\n${yaml({ ...rest, jobs: expanded })}\n`;
}

const outputs = { "turbo.json": turbo(), ".github/workflows/ci.yml": ci() };
const check = parseArgs().flags.has("check");

await run("generate", () => {
  const diags = [];
  for (const [file, content] of Object.entries(outputs)) {
    const p = path.join(root, file);
    const current = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
    if (current === content) continue;
    if (check)
      diags.push({
        kind: "diag",
        code: "S0007",
        path: file,
        line: 1,
        col: 1,
        message: "generated file differs from source; run pnpm generate",
        see: "tooling/generate.mjs",
      });
    else {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content);
    }
  }
  return { diags, counts: { files: Object.keys(outputs).length }, ...(diags.length ? { exit: 2 } : {}) };
});
