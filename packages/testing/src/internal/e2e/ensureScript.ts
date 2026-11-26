/// <reference path="./PageApi.ts" />
// The page script's globals (`__keelE2e`, `__keelProblem`) are declared in PageApi.ts.
import type { Page as Tab } from "playwright-core";
import { pageScript } from "./pageScript.ts";

/** Evaluates the page script in the tab's document when its init script did not run there (scripts off). */
export async function ensureScript(tab: Tab): Promise<void> {
  if (await tab.evaluate(() => globalThis.__keelE2e !== undefined)) return;
  await tab.evaluate(await pageScript());
}
