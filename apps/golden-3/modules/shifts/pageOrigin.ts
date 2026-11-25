/** The origin of the document this code runs in, or undefined on the server and on an opaque page. */
export function pageOrigin(): string | undefined {
  const origin = globalThis.location?.origin;
  return typeof origin === "string" && origin.startsWith("http") ? origin : undefined;
}
