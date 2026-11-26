import type { Browser } from "playwright-core";
import { LOOPBACK_CERT } from "./LOOPBACK_CERT.ts";
import { engineOf } from "./engineOf.ts";
import { fileEnds } from "./fileEnds.ts";
import { spkiHash } from "./spkiHash.ts";

let current: Promise<Browser> | undefined;

/**
 * The test file's browser (k.e2e Browser): started headless on the file's first `open` and closed when the file
 * ends. Chromium trusts the shipped loopback certificate by its key alone; Firefox and WebKit contexts that map an
 * origin skip certificate checks instead (`open`).
 */
export function fileBrowser(): Promise<Browser> {
  if (current !== undefined) return current;
  const made = (async () => {
    const pw = await import("playwright-core");
    const engine = engineOf();
    if (engine === "firefox") return pw.firefox.launch({ headless: true });
    if (engine === "webkit") return pw.webkit.launch({ headless: true });
    return pw.chromium.launch({
      headless: true,
      args: [`--ignore-certificate-errors-spki-list=${spkiHash(LOOPBACK_CERT.cert)}`],
    });
  })();
  current = made;
  fileEnds().push(async () => {
    if (current !== made) return;
    current = undefined;
    const b = await made.catch(() => undefined);
    await b?.close().catch(() => undefined);
  });
  return made;
}
