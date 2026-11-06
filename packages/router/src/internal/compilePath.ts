import type { Segment } from "./Segment.ts";
import { codedError } from "./codedError.ts";

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Compile a route `path` ("/", "/orders/:id") into segments; throws on a malformed path. */
export function compilePath(id: string, path: string): readonly Segment[] {
  if (path === "/") return [];
  if (!path.startsWith("/") || path.endsWith("/"))
    throw codedError("E1503", `${id}: path "${path}" must start with "/" and not end with one`);
  return path
    .slice(1)
    .split("/")
    .map((text): Segment => {
      if (text.startsWith(":")) {
        const name = text.slice(1);
        if (!NAME.test(name)) throw codedError("E1503", `${id}: bad param name "${text}" in "${path}"`);
        return { kind: "param", name };
      }
      if (text === "" || /[?#*]/.test(text))
        throw codedError("E1503", `${id}: bad segment "${text}" in "${path}" (no empty segments or wildcards)`);
      return { kind: "static", text };
    });
}
