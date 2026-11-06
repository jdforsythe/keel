import type { KeelError } from "@keel/schema";

/** The `keel.notFound` error a 404 renders with (no pattern matched, or params failed their schema). */
export function notFound(url: string): KeelError<"keel.notFound", { readonly url: string }> {
  return { code: "keel.notFound", message: "keel.notFound", data: { url } };
}
