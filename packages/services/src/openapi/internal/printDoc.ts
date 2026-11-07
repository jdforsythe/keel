import type { Doc } from "./Doc.ts";

const WIDTH = 120;
const pad = (n: number): string => " ".repeat(n);

/** The one-line text of `d`, or undefined when it holds an object literal with keys (always broken). */
function flat(d: Doc): string | undefined {
  if (typeof d === "string") return d;
  if (d.t === "obj") return d.entries.length === 0 ? "{}" : undefined;
  const parts = (d.t === "arr" ? d.items : d.args).map(flat);
  if (parts.some((p) => p === undefined)) return undefined;
  return d.t === "arr" ? `[${parts.join(", ")}]` : `${d.callee}(${parts.join(", ")})${d.suffix}`;
}

/**
 * Lay out `d` as biome formats it (line width 120, indent 2): one line when it fits and holds no object literal;
 * object literals one key per line; arrays one item per line; a call hugs a sole object or array argument, else
 * puts each argument on its own line; a call with a member suffix that does not fit breaks into a member chain
 * (`s` / `.object(...)` / `.optional()`, one per line). `ind` is the line's indent, `col` the column `d` starts at, `tail` the
 * characters that follow it on its last line.
 */
export function printDoc(d: Doc, ind: number, col: number, tail: number): string {
  const one = flat(d);
  if (one !== undefined && (col + one.length + tail <= WIDTH || typeof d === "string")) return one;
  if (typeof d === "string") return d;
  const inner = ind + 2;
  if (d.t === "obj") {
    const lines = d.entries.map(([k, v]) => `${pad(inner)}${k}: ${printDoc(v, inner, inner + k.length + 2, 1)},\n`);
    return `{\n${lines.join("")}${pad(ind)}}`;
  }
  const dot = d.t === "call" ? d.callee.indexOf(".") : -1;
  if (d.t === "call" && d.suffix !== "" && dot > 0) {
    const call = printDoc({ ...d, callee: d.callee.slice(dot), suffix: "" }, inner, inner, 0);
    const members = d.suffix.match(/\.[A-Za-z_$][\w$]*\(\)/g) ?? [];
    return `${d.callee.slice(0, dot)}\n${pad(inner)}${call}${members.map((m) => `\n${pad(inner)}${m}`).join("")}`;
  }
  const items = d.t === "arr" ? d.items : d.args;
  const sole = items.length === 1 ? items[0] : undefined;
  if (d.t === "call" && sole !== undefined && typeof sole !== "string" && sole.t !== "call") {
    const open = `${d.callee}(`;
    return `${open}${printDoc(sole, ind, col + open.length, 1 + d.suffix.length + tail)})${d.suffix}`;
  }
  const lines = items.map((x) => `${pad(inner)}${printDoc(x, inner, inner, 1)},\n`).join("");
  return d.t === "arr" ? `[\n${lines}${pad(ind)}]` : `${d.callee}(\n${lines}${pad(ind)})${d.suffix}`;
}
