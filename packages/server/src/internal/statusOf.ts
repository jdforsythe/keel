/**
 * HTTP status of an `err` code (k.server): `keel.notFound` 404, `keel.denied` 403, `keel.fields` 422,
 * `keel.payloadTooLarge` 413,
 * `keel.unexpected` 500 (an uncaught throw, or one the server detected), any other code 400.
 */
export function statusOf(code: string): number {
  switch (code) {
    case "keel.notFound":
      return 404;
    case "keel.denied":
      return 403;
    case "keel.fields":
      return 422;
    case "keel.payloadTooLarge":
      return 413;
    case "keel.unexpected":
      return 500;
    default:
      return 400;
  }
}
