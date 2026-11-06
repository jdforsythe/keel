import type { FnInfo } from "./FnInfo.ts";

/** Name of a component's props parameter when it is a plain identifier (`props`), else undefined. */
export function propsNameOf(fn: FnInfo | undefined): string | undefined {
  const p = fn?.node.params[0];
  return p !== undefined && p.type === "Identifier" ? p.name : undefined;
}
