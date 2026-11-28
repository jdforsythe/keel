import { fileURLToPath } from "node:url";
import { build } from "esbuild";

let made: Promise<string> | undefined;

/**
 * The page script (`inPage.ts` and the harness rules it imports, axe-core among them) as one browser script, bundled
 * once per test process and kept.
 */
export function pageScript(): Promise<string> {
  made ??= (async () => {
    const ext = import.meta.url.endsWith(".ts") ? "ts" : "js";
    const entry = fileURLToPath(new URL(`./inPage.${ext}`, import.meta.url));
    const out = await build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
    });
    const file = out.outputFiles[0];
    if (file === undefined) throw new Error("esbuild wrote no page script");
    return file.text;
  })();
  return made;
}
