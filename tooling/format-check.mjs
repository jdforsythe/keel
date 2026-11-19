// Format gate. F0001 a file Biome would reformat; F0002 a file Biome could not read. Runs the formatter in check mode
// over the whole repo (biome.json ignores apply). Usage: node tooling/format-check.mjs [--format=..] [--quiet] [--limit N]
import { spawnSync } from "node:child_process";
import path from "node:path";
import { run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");

/** A path as one shell word: bare when it is plain, else single-quoted with embedded quotes escaped. */
function shellWord(file) {
  return /^[\w@%+=:,./-]+$/.test(file) ? file : `'${file.replaceAll("'", "'\\''")}'`;
}

const fileOf = (d) => String(d.location?.path?.file ?? "").replace(/^\.\//, "");

/** Biome's JSON report to diagnostics: one F0001 per unformatted file, one F0002 per other error. */
export function parseReport(text) {
  const report = JSON.parse(text);
  const diags = [];
  const errors = (report.diagnostics ?? []).filter((d) => d.severity === "error");
  const unreadable = new Set(errors.filter((d) => d.category !== "format").map(fileOf));
  for (const d of errors) {
    const file = fileOf(d);
    if (d.category === "format") {
      if (unreadable.has(file)) continue;
      diags.push({
        kind: "diag",
        code: "F0001",
        path: file,
        message: "not formatted",
        fix: `pnpm exec biome format --write ${shellWord(file)}`,
      });
    } else
      diags.push({
        kind: "diag",
        code: "F0002",
        path: file,
        message: `biome ${d.category ?? "error"}: ${d.description ?? "unreadable"}`.split("\n")[0],
      });
  }
  const s = report.summary ?? {};
  return { diags, files: (s.unchanged ?? 0) + (s.changed ?? 0) + (s.errors ?? 0) };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await run("format", () => {
    const r = spawnSync(
      "pnpm",
      ["exec", "biome", "format", ".", "--reporter=json", "--max-diagnostics=10000", "--colors=off"],
      { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
    );
    const start = r.stdout.indexOf("{");
    if (start < 0) {
      const message = `biome gave no report: ${(r.stderr || "no output").trim().split("\n")[0]}`;
      return { diags: [{ kind: "diag", code: "F0002", message }], counts: { files: 0 } };
    }
    const { diags, files } = parseReport(r.stdout.slice(start));
    return { diags, counts: { files } };
  });
}
