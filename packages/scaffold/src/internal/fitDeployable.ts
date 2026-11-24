import type { ObjectExpression } from "oxc-parser";
import { lineIndent } from "./lineIndent.ts";

/** The longest line an edit leaves on one line; past it the deployable is written one property per line. */
const WIDTH = 120;

/**
 * `next`, the edited `src`, kept as it is unless `deployable` (the object literal of the property starting at `at`)
 * was written on one line and its line in `next` is past 120 columns: then `src` with the deployable written one
 * property per line at its indent, `props` (the edited properties' text, in order) as its properties.
 */
export function fitDeployable(
  src: string,
  next: string,
  deployable: ObjectExpression,
  at: number,
  props: readonly string[],
): string {
  const first = deployable.properties[0];
  const inline = first !== undefined && !src.slice(deployable.start, first.start).includes("\n");
  const line = next.slice(next.lastIndexOf("\n", at) + 1).split("\n")[0] ?? "";
  if (!inline || line.length <= WIDTH) return next;
  const indent = lineIndent(src, at);
  const wide = `{\n${props.map((p) => `${indent}  ${p},\n`).join("")}${indent}}`;
  return `${src.slice(0, deployable.start)}${wide}${src.slice(deployable.end)}`;
}
