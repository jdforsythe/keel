import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser } from "playwright-core";
import { baseEnv } from "./baseEnv.ts";
import { e2eError } from "./e2eError.ts";
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
 * runner ran without it (`--no-sandbox` or Linux as root, each with W1734: `KEEL_E2E_UNSANDBOXED=1`, which the runner
 * always sets, so no value of the developer's environment reaches it) and trusts the run's key alone by its SPKI hash;
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
    const sandbox = process.env.KEEL_E2E_UNSANDBOXED !== "1";
    try {
      return await pw.chromium.launch({
        headless: true,
        env,
        chromiumSandbox: sandbox,
        args: [`--ignore-certificate-errors-spki-list=${createHash("sha256").update(runKey().spki).digest("base64")}`],
      });
    } catch (e) {
      // The sandbox is never turned off to get through (k.e2e-run Browser): a machine that cannot start it says so.
      if (
        sandbox &&
        e instanceof Error &&
        /No usable sandbox|SUID sandbox|new namespace|user namespace/i.test(e.message)
      )
        throw e2eError("E1734", "chromium cannot start its sandbox here", {}, "k.e2e-run");
      throw e;
    }
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
