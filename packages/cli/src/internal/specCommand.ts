import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { makeDiag } from "./makeDiag.ts";
import { projectFiles } from "./projectFiles.ts";
import { summary } from "./summary.ts";
import { unavailable } from "./unavailable.ts";

const CITE_MAX = 160;

/**
 * `keel spec <id>` prints one section verbatim, `--map` (or no id) the map, `--for <code>` every spec line citing
 * the code. Spec files come from `io.files` (`spec/**.md`); none at all is I1055. An unknown id is E1052.
 */
export function specCommand(input: Input, io: Io): OutRecord[] {
  const specs = projectFiles(io).filter((f) => f.path.startsWith("spec/") && f.path.endsWith(".md"));
  if (specs.length === 0) return unavailable("spec", "spec/*.md in the project", "k.cli");
  const given = [input.id !== undefined, input.for !== undefined, input.map === true].filter(Boolean).length;
  if (given > 1) {
    const d = makeDiag("E1052", "give one of <id>, --for <code>, --map", { see: "k.cli" });
    return [d, summary("spec", [d], {})];
  }
  const code = input.for;
  if (code !== undefined) {
    const cites: OutRecord[] = specs.flatMap((f) =>
      f.source
        .split("\n")
        .flatMap((l, i) =>
          l.includes(code)
            ? [{ kind: "spec.cite", code, path: f.path, line: i + 1, text: l.trim().slice(0, CITE_MAX) }]
            : [],
        ),
    );
    return [...cites, summary(`spec --for ${code}`, [], { lines: cites.length })];
  }
  const id = input.map === true || input.id === undefined ? "map" : input.id;
  const want = id === "map" ? ["spec/00-map.md"] : [`spec/kernel/${id}.md`, `spec/std/${id}.md`];
  const file = want.map((p) => specs.find((f) => f.path === p)).find((f) => f !== undefined);
  if (file === undefined) {
    const d = makeDiag("E1052", `no spec section ${JSON.stringify(id.slice(0, 24))}; see keel spec --map`, {
      see: "k.cli",
    });
    return [d, summary("spec", [d], {})];
  }
  return [
    { kind: "spec.section", id, text: file.source },
    summary(`spec ${id}`, [], { tokens: Math.ceil(file.source.length / 4) }),
  ];
}
