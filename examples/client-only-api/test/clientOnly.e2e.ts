// A client app with no server (k.origins, k.services Encoding). The build writes `dist/web` alone, its `csp.txt` adding
// the declared `https://api.github.com` to `connect-src` and no other origin anywhere. A plain file host sends it with
// that policy; in Chromium, with `api.github.com` mapped to a stand-in of the test (never the internet), the home page
// links to the releases page, which shows the stand-in's list on the click and on a reload; no request goes to a Keel
// server path (`/__keel/*`) or any other host. The stand-in is as strict as a real API: its preflight answer allows no
// request header and no credentials, so a Keel header would fail the call; the plain GET needs no preflight, and no
// `x-keel`, `x-keel-user`, `authorization` or cookie reaches it. The same tree with no `origins` fails `keel check`
// with E1571. No page or console error is raised (an unread one fails the test).
import { execFile } from "node:child_process";
import { cp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { answer, serve } from "@keel/testing/e2e";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { expect, it } from "vitest";

const here = join(import.meta.dirname, "..");
const API = "https://api.github.com/repos/nodejs/node/releases?per_page=5";
const SKIP = new Set(["node_modules", "dist", ".keel-dev", ".turbo", "reports"]);

/** A policy string as a map of directive to its source list. */
function directives(policy: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of policy.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name !== undefined && name !== "") map.set(name, sources.join(" "));
  }
  return map;
}

it("the page reads GitHub's API from the browser alone: the policy names it, no Keel header or path reaches anyone", async () => {
  expect(await readdir(join(here, "dist"))).toEqual(["web"]);
  const policy = (await readFile(join(here, "dist", "web", "csp.txt"), "utf8")).trim();
  const map = directives(policy);
  expect(map.get("connect-src")).toBe("'self' https://api.github.com");
  expect([...map].filter(([k, v]) => k !== "connect-src" && /https?:/.test(v))).toEqual([]);

  // A strict API: any origin may read it, with no credentials and no request header beyond the safelisted ones.
  const cors = { "access-control-allow-origin": "*" };
  const github = await answer((request) =>
    request.method === "OPTIONS"
      ? new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET" } })
      : Response.json([{ tag_name: "v0.0.1", name: "Served by the stand-in", published_at: null }], { headers: cors }),
  );
  const app = await serve({ origins: { "https://api.github.com": github } });
  // One cookie for this app's origin and one for GitHub's: neither may reach the stand-in.
  const page = await app.open("/", {
    cookies: [
      { name: "keel.caller", value: "c1", origin: app.origin() },
      { name: "gh", value: "g1", origin: "https://api.github.com", sameSite: "None", secure: true },
    ],
  });
  expect((await page.find("app.home.title")).text).toBe("A site with no server");

  await page.fire("app.nav.releases", { type: "click" });
  await page.until("app.releases.list", { text: /v0\.0\.1/ });
  await page.reload();
  await page.until("app.releases.list", { text: /v0\.0\.1/ });

  // Two plain GETs, no preflight (an OPTIONS would be in the log), and none of the headers a Keel server would be sent.
  const heard = github.requests();
  expect(heard.map((r) => `${r.method} ${r.url}`)).toEqual([`GET ${API}`, `GET ${API}`]);
  const names = heard.flatMap((r) => r.headers);
  for (const banned of ["x-keel", "x-keel-user", "authorization", "cookie"]) expect(names).not.toContain(banned);

  // The tab asked this app's origin and GitHub's, and no `/__keel/*` path.
  const asked = page.requests().map((r) => r.url);
  expect(asked.filter((u) => new URL(u).pathname.startsWith("/__keel"))).toEqual([]);
  expect(asked.filter((u) => !u.startsWith(`${app.origin()}/`) && !u.startsWith("https://api.github.com/"))).toEqual(
    [],
  );
  expect(page.problems()).toEqual([]);
});

// The copy's check is the machine's own work, not a bound the test chose.
it("the same tree with no declared origin fails keel check with E1571", { timeout: fixedTime(240_000) }, async () => {
  const tmp = tempDir("keel-e2e-undeclared-");
  const copy = join(tmp, "app");
  try {
    await cp(here, copy, { recursive: true, filter: (src) => src === here || !SKIP.has(basename(src)) });
    await symlink(join(here, "node_modules"), join(copy, "node_modules"), "dir");
    const topo = join(copy, "topology.ts");
    const text = await readFile(topo, "utf8");
    const next = text.replace(/origins: \{.*\},\n/, "origins: {},\n");
    if (next === text) throw new Error("the topology has no declared origins to remove");
    await writeFile(topo, next);

    const env = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !/^(?:KEEL_|VITEST)|^NODE_ENV$/.test(k)),
    );
    const out = await new Promise<{ failed: boolean; text: string }>((done) => {
      execFile(
        process.execPath,
        ["--disable-warning=ExperimentalWarning", join(here, "node_modules", "@keel", "cli", "src", "bin.ts"), "check"],
        { cwd: copy, env: { ...env, KEEL_AGENT: "1" }, maxBuffer: 64 * 1024 * 1024 },
        (e, stdout, stderr) => done({ failed: e !== null, text: `${stdout}${stderr}` }),
      );
    });
    expect(out.failed).toBe(true);
    expect(out.text).toContain("E1571 modules/app/githubApi.ts");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
