import type { Op } from "@keel/scaffold";
import type { Input } from "../types/Input.ts";
import { cliVersion } from "./cliVersion.ts";

const parseDefault = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Map cli input to the `@keel/scaffold` input of `op` (k.scaffold CLI examples). Missing values stay absent
 * so `@keel/scaffold` reports them (E1052). `library` carries the running `@keel/cli`'s version (`cliVersion`) and whether `exists` finds its folder. `generated` is the `openapi` output of `service --openapi`; `--base` and `--reason` pass as they are. `--default` is read as JSON when it parses, else as a string.
 */
export function scaffoldInput(
  op: Op,
  input: Input,
  generated: { readonly schema: string; readonly service: string } | undefined = undefined,
  exists?: (dir: string) => boolean,
): Record<string, unknown> {
  const [a, b, c] = input.args ?? [];
  const pick = (entries: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(entries).filter(([, v]) => v !== undefined));
  switch (op) {
    case "project":
      return pick({ name: a, adapter: input.adapter, workspace: input.workspace });
    case "module":
    case "component":
    case "store":
    case "transaction":
      return pick({ id: a });
    case "service":
      return pick({
        id: a,
        name: input.name,
        base: input.base,
        schema: generated?.schema,
        service: generated?.service,
        reason: input.reason,
      });
    case "route":
      return pick({
        id: a,
        path: input.path,
        file: input.file,
        api: input.api,
        method: input.method,
        "no-loader": input["no-loader"],
      });
    case "library":
      return pick({
        name: a,
        version: cliVersion(),
        exists: a === undefined ? undefined : exists?.(a.slice(a.indexOf("/") + 1)),
      });
    case "shell":
      return pick({ shell: a, id: input.id, name: input.name, to: input.to });
    case "rename":
      return pick({ kind: input.kind, from: a, to: b });
    case "move":
      return pick({ name: a, to: input.to });
    case "place":
      return pick({ module: a, to: input.to, adapter: input.adapter });
    case "add-field":
      return pick({
        schema: a,
        field: b,
        type: c,
        default: input.default === undefined ? undefined : parseDefault(input.default),
      });
  }
}
