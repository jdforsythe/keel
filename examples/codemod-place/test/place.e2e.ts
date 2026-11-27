// On a copy under the example's `dist/placed`, `keel codemod place stock --to api --adapter node` gives a tree whose `keel check`,
// `keel test` and `keel build` pass; its built `web` shows the count from its `api` peer; placing `stock` back in `web`
// restores `topology.ts` and `deploy/` byte for byte. No page or console error is raised (an unread one fails the test).
import { execFile } from "node:child_process";
import { cp, readFile, readdir, rm, stat, symlink } from "node:fs/promises";
import { join } from "node:path";
import { build, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";

const here = join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", "dist", ".keel-dev", ".turbo", "reports"]);

/** `keel <args>` in `dir`, none of the test run's own `KEEL_*` variables set; rejects with its output when it fails. */
function keel(dir: string, args: readonly string[]): Promise<string> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(?:KEEL_|VITEST)|^NODE_ENV$/.test(k)));
  return new Promise((done, failed) => {
    execFile(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", join(here, "node_modules", "@keel", "cli", "src", "bin.ts"), ...args],
      { cwd: dir, env: { ...env, KEEL_AGENT: "1" }, maxBuffer: 64 * 1024 * 1024 },
      (e, out, err) => (e === null ? done(out) : failed(new Error(`keel ${args.join(" ")}: ${out}${err}`))),
    );
  });
}

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

// The codemod, the check, the tests and the build of a copy are the machine's own work, not a bound the test chose.
it(
  "placing stock on an api gives a tree that checks, tests, builds and shows the peer's count; placing it back restores the files",
  { timeout: fixedTime(600_000) },
  async () => {
    // The copy sits in the example's own `dist/`, inside the workspace, as a placed app's files are written there.
    const tmp = join(here, "dist", "placed");
    const copy = tmp;
    await rm(tmp, { recursive: true, force: true });
    try {
      for (const entry of await readdir(here))
        if (!SKIP.has(entry)) await cp(join(here, entry), join(copy, entry), { recursive: true });
      await symlink(join(here, "node_modules"), join(copy, "node_modules"), "dir");
      await keel(copy, ["codemod", "place", "stock", "--to", "api", "--adapter", "node"]);
      await keel(copy, ["check"]);
      await keel(copy, ["test"]);
      await build(copy);

      const app = await serve({ project: copy });
      const page = await app.open("/", { deployable: "web" });
      expect((await page.find("shop.home.shelf")).text).toContain("4 lamps on the shelf");
      await app.stop();

      await keel(copy, ["codemod", "place", "stock", "--to", "web"]);
      for (const path of ["topology.ts", "deploy/compose.yaml"])
        expect(await readFile(join(copy, path), "utf8")).toBe(await readFile(join(here, path), "utf8"));
      expect(await exists(join(copy, "deploy", "api"))).toBe(false);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  },
);
