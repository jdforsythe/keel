// The Tauri files register the shell's id as a deep-link scheme; a plain client host sends `dist/web` for any path, and
// Chromium opening `/places/oslo` there lands on that place's page. The shell's own web build (`KEEL_SHELL=tauri`, the
// build `keel build --target tauri` runs before cargo, with no `KEEL_ORIGIN` as the app has no `node` deployable) has
// no identity source and still carries the deep-link listener, so the built shell takes a page link (k.shell Shell
// ctx). No page or console error is raised (an unread one fails the test).
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";

const here = join(import.meta.dirname, "..");

/** The shell's web build: vite with the variables `keel build --target tauri` sets, none of the test run's own. */
function shellBuild(): Promise<void> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(?:KEEL_|VITEST)|^NODE_ENV$/.test(k)));
  return new Promise((done, failed) => {
    execFile(
      process.execPath,
      [join(here, "node_modules", "vite", "bin", "vite.js"), "build"],
      { cwd: here, env: { ...env, KEEL_DEPLOYABLE: "web", KEEL_SHELL: "tauri", NODE_ENV: "production" } },
      (e, _out, err) => (e === null ? done() : failed(new Error(err))),
    );
  });
}

// The shell build is the machine's own work, not a bound the test chose.
it(
  "the shell registers the app's id, carries the deep-link listener and a page link lands on that page",
  { timeout: fixedTime(240_000) },
  async () => {
    const conf = await readFile(join(here, "deploy", "web", "tauri", "tauri.conf.json"), "utf8");
    expect(conf).toContain('"schemes": ["dev.keel.linksin"]');

    await shellBuild();
    const www = join(here, "dist", "web", "tauri", "www", "assets");
    const files = (await readdir(www)).filter((f) => f.endsWith(".js"));
    const bundle = (await Promise.all(files.map((f) => readFile(join(www, f), "utf8")))).join("\n");
    expect(bundle).toContain("plugin:deep-link|get_current");

    const app = await serve();
    const page = await app.open("/places/oslo");
    expect((await page.find("places.place.title")).text).toBe("oslo");
  },
);
