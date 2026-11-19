// Repository hygiene for a public repository. H0001 <path>:<line>:<col> a home-directory path in a tracked file;
// H0002 <path>:<line>:<col> a quotation of the operator's words under docs/ or tasks/.
// A placeholder segment (`/Users/<name>`) and CI's `/home/runner` are allowed. A quotation is caught when a double-quoted
// span of four or more words follows an attribution to the operator or user, a colon or comma cue, or directly after
// a speech verb (said, wrote, asked, told, says, writes, replied) or "in their words" on the same line. Code spans are ignored.
// Usage: node tooling/hygiene.mjs [--format=..] [--quiet]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { run } from "./output.ts";

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

const tracked = () => {
  const r = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return (r.stdout ?? "").split("\0").filter((f) => f !== "" && !SKIP_FILES.has(f) && !BINARY.test(f));
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await run("hygiene", () => {
    const diags = [];
    const files = tracked().filter((f) => fs.existsSync(path.join(root, f)));
    for (const file of files) {
      const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
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
