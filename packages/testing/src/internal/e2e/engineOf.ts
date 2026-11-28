import type { Engine } from "./Engine.ts";

/** The engine of this run: `KEEL_E2E_ENGINE`, which `keel test --e2e` sets from `--engine`; default `chromium`. */
export function engineOf(env: Readonly<Record<string, string | undefined>> = process.env): Engine {
  const e = env.KEEL_E2E_ENGINE;
  return e === "firefox" || e === "webkit" ? e : "chromium";
}
