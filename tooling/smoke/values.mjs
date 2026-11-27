// The k.values Stylesheet invariant in headless Chromium (`cssKept.mjs`): every rule the compiler emits from token
// values is kept with every declaration it was emitted with, each edge case of the value grammar is refused or takes
// effect, and each attack value is refused (E1807) before emission. It needs no app: the sheets are parsed on a blank
// page. Usage: node --disable-warning=ExperimentalWarning tooling/smoke/values.mjs. Nothing is written; the browser is
// closed on every path.
import { chromium } from "playwright-core";
import { fixedTime } from "../test-time.ts";
import { recorder } from "./built.mjs";
import { cssKept } from "./cssKept.mjs";

const LIMIT_MS = fixedTime(120_000);
const { step, finish } = recorder();
let browser;

const limit = setTimeout(async () => {
  step("time limit", false, `${LIMIT_MS / 1000}s`);
  await browser?.close().catch(() => undefined);
  finish("values");
  process.exit(1);
}, LIMIT_MS);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await browser?.close().catch(() => undefined);
    process.exit(130);
  });
}

try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await cssKept(page, step);
  step("no page errors", errors.length === 0, `${errors.length} errors`);
} catch (e) {
  step("run", false, e instanceof Error ? e.message : String(e));
} finally {
  clearTimeout(limit);
  await browser?.close().catch(() => undefined);
}
finish("values");
