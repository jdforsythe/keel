import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser } from "playwright-core";
import { baseEnv } from "./baseEnv.ts";
import { engineOf } from "./engineOf.ts";
import { fileEnds } from "./fileEnds.ts";
import { runKey } from "./runKey.ts";

let current: Promise<Browser> | undefined;
/** The browser's own folder (its `HOME` and temporary folders), removed when the browser closes. */
let home: string | undefined;

/**
 * The test file's browser (k.e2e-run Browser): started headless on the file's first `open` and closed when the file
 * ends, with the run's environment allowlist and its `HOME` and temporary folders in a folder of its own inside the run
 * folder (`TMPDIR`), where Playwright also makes its new, empty profile. Chromium runs with its sandbox on unless the
 * runner turned it off (`KEEL_E2E_SANDBOX=0`, Linux as root, W1734) and trusts the run's key alone by its SPKI hash;
 * Firefox and WebKit contexts that map an origin skip certificate checks instead (`open`).
 */
export function fileBrowser(): Promise<Browser> {
  if (current !== undefined) return current;
  const made = (async () => {
    const pw = await import("playwright-core");
    const engine = engineOf();
    home = mkdtempSync(join(tmpdir(), "keel-e2e-browser-"));
    const env = baseEnv(home);
    if (engine === "firefox") return pw.firefox.launch({ headless: true, env });
    if (engine === "webkit") return pw.webkit.launch({ headless: true, env });
    return pw.chromium.launch({
      headless: true,
      env,
      chromiumSandbox: process.env.KEEL_E2E_SANDBOX !== "0",
      args: [`--ignore-certificate-errors-spki-list=${createHash("sha256").update(runKey().spki).digest("base64")}`],
    });
  })();
  current = made;
  fileEnds().push(async () => {
    if (current !== made) return;
    current = undefined;
    const b = await made.catch(() => undefined);
    await b?.close().catch(() => undefined);
    if (home !== undefined) rmSync(home, { recursive: true, force: true });
    home = undefined;
  });
  return made;
}
