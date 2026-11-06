import type { Op } from "@keel/scaffold";
import type { Input } from "../types/Input.ts";

const parseDefault = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Map cli input to the `@keel/scaffold` input of `op` (k.scaffold CLI examples). Missing values stay absent
 * so `@keel/scaffold` reports them (E1052). `--default` is read as JSON when it parses, else as a string.
 */
export function scaffoldInput(op: Op, input: Input): Record<string, unknown> {
  const [a, b, c] = input.args ?? [];
  const pick = (entries: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(entries).filter(([, v]) => v !== undefined));
  switch (op) {
    case "project":
      return pick({ name: a, adapter: input.adapter, workspace: input.workspace });
    case "module":
    case "component":
    case "store":
      return pick({ id: a });
    case "route":
      return pick({ id: a, path: input.path, file: input.file });
    case "rename":
      return pick({ kind: input.kind, from: a, to: b });
    case "move":
      return pick({ name: a, to: input.to });
    case "add-field":
      return pick({
        schema: a,
        field: b,
        type: c,
        default: input.default === undefined ? undefined : parseDefault(input.default),
      });
  }
}
