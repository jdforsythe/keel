import type { Page as Tab } from "playwright-core";
import { pageScript } from "./pageScript.ts";

/** Evaluates the page script in the tab's document when its init script did not run there (scripts off). */
export async function ensureScript(tab: Tab): Promise<void> {
  if (await tab.evaluate(() => globalThis.__keelE2e !== undefined)) return;
  await tab.evaluate(await pageScript());
}
