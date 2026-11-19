// Voice lint (docs/BRAND.md section 5, docs/VOICE.md): banned words, hedges, em dashes, stock phrases and reversals
// in docs, READMEs, skills, specs, app copy and code comments. V0003 <path>:<line>:<col> <rule>.
// Code spans, fenced code, BRAND.md and VOICE.md themselves are excluded.
import fs from "node:fs";
import path from "node:path";
import { run } from "./output.ts";
import { walk } from "./scan.mjs";

const root = path.join(import.meta.dirname, "..");
const BANNED = [
  "seamless",
  "powerful",
  "blazing",
  "magic",
  "revolutionary",
  "effortless",
  "simply",
  "just",
  "leverage",
  "robust",
  "cutting-edge",
  "AI-powered",
  "supercharge",
];
const VOICE_WORDS = [
  "crucially",
  "fundamentally",
  "importantly",
  "delve",
  "game-changer",
  "paradigm",
  "rapidly evolving",
  "landscape",
];
const HEDGES = ["arguably", "somewhat", "relatively"];
const word = (list) =>
  new RegExp(`(?<![\\w-])(?:${list.map((w) => w.replace(/-/g, "[-\\u2011]")).join("|")})(?![\\w-])`, "gi");
const RULES = [
  [word(BANNED), (w) => `banned word "${w}" (BRAND.md §5)`],
  [word(VOICE_WORDS), (w) => `banned word "${w}" (VOICE.md)`],
  [word(HEDGES), (w) => `hedging adverb "${w}" (VOICE.md)`],
  [/\u2014| -- /g, () => "em dash; use a comma, period or colon (VOICE.md)"],
  [/here's the thing|the whole story/gi, (w) => `stock phrase "${w}" (VOICE.md)`],
  [/\b(?:it's|it is|this is) not [^.;]{1,60}, (?:it's|it is)\b/gi, () => "reversal \"it's not X, it's Y\" (VOICE.md)"],
];

const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const under = (d, test) => walk(path.join(root, d)).filter((p) => test(rel(p)));

/** Prose lines of a markdown file: [line, text] with fenced code dropped and code spans blanked to spaces. */
function markdownLines(src) {
  const out = [];
  let fence = "";
  src.split("\n").forEach((raw, i) => {
    const m = /^\s*(`{3,}|~{3,})/.exec(raw);
    if (m) {
      const mark = m[1][0];
      if (!fence) fence = mark;
      else if (fence === mark) fence = "";
      return;
    }
    if (fence) return;
    out.push([i + 1, raw.replace(/(`+)[^`]*?\1/g, (s) => " ".repeat(s.length))]);
  });
  return out;
}

/** Copy lines of a .tsx file: JSX text and string literals that contain letters; imports and bare identifiers are skipped. */
function tsxLines(src) {
  const out = [];
  src.split("\n").forEach((raw, i) => {
    if (/^\s*(import|export\s+\{)/.test(raw) || /^\s*(\/\/|\*|\/\*)/.test(raw)) return;
    const parts = [];
    raw.replace(/(["'`])((?:\\.|(?!\1).)*)\1/g, (s, _q, _b, off) => {
      parts.push([off, s]);
      return s;
    });
    let masked = " ".repeat(raw.length);
    for (const [off, s] of parts) masked = masked.slice(0, off) + s + masked.slice(off + s.length);
    const jsx = />([^<>{}]*[A-Za-z][^<>{}]*)</g;
    for (const m of raw.matchAll(jsx)) {
      const off = (m.index ?? 0) + 1;
      masked = masked.slice(0, off) + m[1] + masked.slice(off + m[1].length);
    }
    out.push([i + 1, masked]);
  });
  return out;
}

/** Comment text of a TS/TSX file: [line, text] with string literals and code skipped (positions preserved). */
function commentLines(src) {
  const out = [];
  let block = false;
  let quote = "";
  src.split("\n").forEach((raw, i) => {
    let masked = "";
    for (let k = 0; k < raw.length; k++) {
      const c = raw[k];
      const two = raw.slice(k, k + 2);
      if (block) {
        if (two === "*/") {
          block = false;
          masked += "  ";
          k++;
        } else masked += c;
      } else if (quote) {
        masked += " ";
        if (c === "\\") {
          masked += " ";
          k++;
        } else if (c === quote) quote = "";
      } else if (two === "//") {
        masked += "  " + raw.slice(k + 2);
        break;
      } else if (two === "/*") {
        block = true;
        masked += "  ";
        k++;
      } else if (c === '"' || c === "'" || c === "`") {
        quote = c;
        masked += " ";
      } else masked += " ";
    }
    if (quote && quote !== "`") quote = "";
    out.push([i + 1, masked]);
  });
  return out;
}

await run("voice-lint", () => {
  const targets = [
    ...["README.md"].filter((f) => fs.existsSync(path.join(root, f))).map((f) => [path.join(root, f), "md"]),
    ...under("docs", (r) => r.endsWith(".md") && r !== "docs/BRAND.md" && r !== "docs/VOICE.md").map((p) => [p, "md"]),
    ...under("packages", (r) => /^packages\/[^/]+\/README\.md$/.test(r)).map((p) => [p, "md"]),
    ...under("apps", (r) => /^apps\/[^/]+\/README\.md$/.test(r)).map((p) => [p, "md"]),
    ...under(".claude/skills", (r) => r.endsWith("/SKILL.md")).map((p) => [p, "md"]),
    ...under("packages/cli/skills", (r) => r.endsWith("/SKILL.md")).map((p) => [p, "md"]),
    ...under("spec", (r) => r.endsWith(".md")).map((p) => [p, "md"]),
    ...under("apps", (r) => /^apps\/[^/]+\/modules\/.*\.tsx$/.test(r)).map((p) => [p, "tsx"]),
    ...under("apps", (r) => /^apps\/[^/]+\/modules\/.*\.tsx?$/.test(r)).map((p) => [p, "comment"]),
    ...under("packages", (r) => /^packages\/[^/]+\/src\/.*\.ts$/.test(r)).map((p) => [p, "comment"]),
  ];
  const diags = [];
  for (const [file, kind] of targets) {
    const src = fs.readFileSync(file, "utf8");
    for (const [line, text] of kind === "md" ? markdownLines(src) : kind === "tsx" ? tsxLines(src) : commentLines(src))
      for (const [re, msg] of RULES)
        for (const m of text.matchAll(re))
          diags.push({
            kind: "diag",
            code: "V0003",
            path: rel(file),
            line,
            col: (m.index ?? 0) + 1,
            message: msg(m[0]),
          });
  }
  return {
    diags,
    counts: { files: targets.length, hits: diags.length },
    line: `ok voice-lint ${targets.length} files`,
  };
});
