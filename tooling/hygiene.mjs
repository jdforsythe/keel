// Repository hygiene for a public repository. H0001 <path>:<line>:<col> a home-directory path in a tracked file;
// H0002 <path>:<line>:<col> a quotation of the operator's words under docs/ or tasks/.
// A placeholder segment (`/Users/<name>`) and CI's `/home/runner` are allowed. A quotation is caught when a double-quoted
// span of four or more words follows an attribution to the operator or user, a colon or comma cue, or directly after
// a speech verb (said, wrote, asked, told, says, writes, replied) or "in their words" on the same line. Code spans are ignored.
// H0003 a package.json declaring a licence other than UNLICENSED, or the root without it, or a missing or changed LICENSE;
// H0004 a packages/*/package.json that is not `"private": true`; H0005 a personal word or email listed (as SHA-256 hashes)
// in tooling/hygiene.refuse.json found in a tracked file; H0006 with --launch: a placeholder in SECURITY.md.
// Usage: node tooling/hygiene.mjs [--format=..] [--quiet] [--launch]
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs, run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const SKIP_FILES = new Set(["pnpm-lock.yaml"]);
const BINARY = /\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz|wasm|svg|mp4|webm)$/i;
const HOME = /(?:\/Users\/(?!<)[A-Za-z0-9._-]+|\/home\/(?!runner\b|<)[A-Za-z0-9._-]+)/g;
const WHO = String.raw`\b(?:operator|user|director)(?:['’]s)?\b`;
const QUOTE = String.raw`["“]([^"”\n]+)["”]`;
const CUE = new RegExp(`${WHO}[^"\\u201c\\n.]{0,70}?[:,(]\\s*(?:and\\s+)?${QUOTE}`, "gi");
const SPEECH = new RegExp(
  `\\b(?:operator|user)\\s+(?:said|wrote|asked|told\\s+\\w+|says|writes|replied)\\b\\W{0,3}${QUOTE}`,
  "gi",
);
const WORDS = new RegExp(`${WHO}[^"\\u201c\\n.]{0,40}\\bin (?:their|his|her) words\\b\\W{0,3}${QUOTE}`, "gi");

/** [index, text] of each home-directory path in `text`; `text` is one line. */
export function homePaths(text) {
  return [...text.matchAll(HOME)].map((m) => [m.index ?? 0, m[0]]);
}

/** Indexes of attributed quotations in `text`, one line with code spans blanked first. */
export function quotations(text) {
  const plain = text.replace(/(`+)[^`]*?\1/g, (s) => " ".repeat(s.length));
  const out = new Set();
  for (const re of [CUE, SPEECH, WORDS])
    for (const m of plain.matchAll(re)) if (m[1].trim().split(/\s+/).length >= 4) out.add(m.index ?? 0);
  return [...out].sort((a, b) => a - b);
}

const sha = (t) => createHash("sha256").update(t).digest("hex");
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/** [index, text] of each refused word or address in `text`; `refuse` is `{ words, emails }` of SHA-256 hashes. */
export function personal(text, refuse) {
  const words = new Set(refuse.words ?? []);
  const emails = new Set(refuse.emails ?? []);
  const out = [];
  for (const m of text.matchAll(EMAIL))
    if (emails.has(sha(m[0].toLowerCase()))) out.push([m.index ?? 0, "an email address"]);
  for (const m of text.matchAll(/[A-Za-z]+/g))
    if (words.has(sha(m[0].toLowerCase()))) out.push([m.index ?? 0, "a personal name"]);
  return out;
}

/** Messages for a parsed package.json: `file` is its repo-relative path, `isRoot` the root one. */
export function packageIssues(file, pkg, isRoot) {
  const out = [];
  const lic = pkg.license;
  if (isRoot ? lic !== "UNLICENSED" : lic !== undefined && lic !== "UNLICENSED")
    out.push([
      "H0003",
      `licence ${JSON.stringify(lic)}; all rights reserved until launch, so "UNLICENSED"${isRoot ? "" : " or none"}`,
    ]);
  if (/^packages\/[^/]+\/package\.json$/.test(file) && pkg.private !== true)
    out.push(["H0004", 'a package must be "private": true until launch']);
  return out;
}

const tracked = () => {
  const r = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return (r.stdout ?? "").split("\0").filter((f) => f !== "" && !SKIP_FILES.has(f) && !BINARY.test(f));
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await run("hygiene", () => {
    const diags = [];
    const launch = parseArgs().flags.has("launch");
    const refuse = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "hygiene.refuse.json"), "utf8"));
    const add = (code, file, line, col, message) => diags.push({ kind: "diag", code, path: file, line, col, message });
    const licence = fs.existsSync(path.join(root, "LICENSE"))
      ? fs.readFileSync(path.join(root, "LICENSE"), "utf8")
      : "";
    if (!/all rights reserved/i.test(licence))
      add("H0003", "LICENSE", 1, 1, "LICENSE must state all rights reserved until launch");
    const files = tracked().filter((f) => fs.existsSync(path.join(root, f)));
    for (const file of files) {
      const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
      if (path.basename(file) === "package.json") {
        let pkg;
        try {
          pkg = JSON.parse(lines.join("\n"));
        } catch {
          pkg = undefined;
        }
        if (pkg !== undefined)
          for (const [code, message] of packageIssues(file, pkg, file === "package.json"))
            add(code, file, 1, 1, message);
      }
      if (launch && file === "SECURITY.md")
        lines.forEach((text, i) => {
          const col = text.indexOf("<domain to be set at launch>");
          if (col >= 0) add("H0006", file, i + 1, col + 1, "launch: the security address is still a placeholder");
        });
      const prose = /^(?:docs|tasks)\/.*\.md$/.test(file);
      lines.forEach((text, i) => {
        for (const [col, hit] of homePaths(text))
          diags.push({
            kind: "diag",
            code: "H0001",
            path: file,
            line: i + 1,
            col: col + 1,
            message: `home-directory path ${hit}; use a repo-relative path`,
          });
        if (file !== "tooling/hygiene.refuse.json")
          for (const [col, what] of personal(text, refuse))
            add("H0005", file, i + 1, col + 1, `${what} in a tracked file`);
        if (prose)
          for (const col of quotations(text))
            diags.push({
              kind: "diag",
              code: "H0002",
              path: file,
              line: i + 1,
              col: col + 1,
              message: "quoted operator speech; state the decision in plain words",
            });
      });
    }
    return { diags, counts: { files: files.length, hits: diags.length }, line: `ok hygiene ${files.length} files` };
  });
}
