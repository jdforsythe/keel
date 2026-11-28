import { diagLine } from "./diagLine.ts";

/**
 * The one `diag` of a coded refusal at start (k.deploy Refusals at start): its own code, its message whole without
 * the leading code, and its `see`, in production too.
 */
export function refusedLine(format: "compact" | "json", e: Error & { readonly code: string }): string {
  const see: unknown = Reflect.get(e, "see");
  const message = e.message.startsWith(`${e.code} `) ? e.message.slice(e.code.length + 1) : e.message;
  return diagLine(format, { code: e.code, message, ...(typeof see === "string" ? { see } : {}) });
}
