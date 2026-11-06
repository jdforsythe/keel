// pnpm spec <id> | --map | --for E1042. Prints one spec section, compact. Warns if over budget.
import fs from "node:fs";
import path from "node:path";
import { emit, limit, parseArgs } from "./output.ts";
import { walk } from "./scan.mjs";

const root = path.join(import.meta.dirname, "..");
const a = parseArgs();
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "budgets.json"), "utf8")).output;
const fail = (code, message) => {
  console.log(emit([{ kind: "diag", code, message }]));
  process.exit(1);
};

const code = a.values.get("for");
if (code) {
  const hits = walk(path.join(root, "spec"))
    .filter((f) => f.endsWith(".md"))
    .flatMap((f) =>
      fs
        .readFileSync(f, "utf8")
        .split("\n")
        .flatMap((l, i) =>
          l.includes(code)
            ? [
                {
                  kind: "diag",
                  code,
                  path: path.relative(root, f),
                  line: i + 1,
                  col: l.indexOf(code) + 1,
                  message: l.trim().slice(0, 89),
                },
              ]
            : [],
        ),
    );
  if (!hits.length) fail("E0002", `no spec mentions ${code}`);
  console.log(emit(hits, limit() ?? 10));
  process.exit(0);
}

const arg = a.positional[0];
const isMap = !arg || a.flags.has("map");
const sec = path.join(root, "spec", "kernel", `${arg}.md`);
const file = isMap
  ? path.join(root, "spec", "00-map.md")
  : fs.existsSync(sec)
    ? sec
    : path.join(root, "spec", "std", `${arg}.md`);
if (!fs.existsSync(file)) fail("E0002", `no spec section ${arg}; run pnpm spec --map`);
const text = fs.readFileSync(file, "utf8");
const tokens = Math.ceil(text.length / 4);
const budget = isMap ? budgets["spec.map"] : budgets["spec.section"];
if (tokens > budget)
  console.log(
    emit([
      {
        kind: "diag",
        code: "W0001",
        path: path.relative(root, file),
        message: `~${tokens} tokens exceeds budget ${budget}`,
      },
    ]),
  );
process.stdout.write(text);
