// Spec: std.report, clause "With `KEEL_REPORT_TOKEN=t` in `io.env` that request carries `cookie: __Host-keel-caller=t` over https and `cookie: keel-caller=t` over http; a `url` without path or query gets none."
// Seed 1337
import { run } from "@keel/cli";
import { tallyOf } from "@keel/std-report";
import "@keel/std-report/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

const cookieOf = (init: RequestInit | undefined): string | null => {
  const h = init?.headers;
  if (h === undefined) return null;
  if (h instanceof Headers) return h.get("cookie");
  if (Array.isArray(h)) return h.find(([k]) => k?.toLowerCase() === "cookie")?.[1] ?? null;
  const key = Object.keys(h).find((k) => k.toLowerCase() === "cookie");
  return key === undefined ? null : (h[key] ?? null);
};
const inspectDoc = {
  live: true,
  graph: { nodes: [], edges: [] },
  stores: {},
  ids: {},
  a11y: {},
  routes: {},
  sections: {},
};
const recorder = (body: unknown, seen: (string | null)[]) => ({
  fetch: (_url: string, init?: RequestInit): Promise<Response> => {
    seen.push(cookieOf(init));
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  },
});
const tally = tallyOf("a", ["x"]);

test("With `KEEL_REPORT_TOKEN=t` in `io.env` the request to an https route carries `cookie: __Host-keel-caller=t`", async () => {
  // seed 1337: any token of cookie-safe characters
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[A-Za-z0-9]{1,16}$/), async (t) => {
      const seen: (string | null)[] = [];
      const r = await run(["report", "https://h/t?x=1", "--format=compact"], {
        cwd: "/work/app",
        files: [],
        env: { KEEL_REPORT_TOKEN: t },
        ...recorder(tally, seen),
      });
      expect(r.code).toBe(0);
      expect(seen).toEqual([`__Host-keel-caller=${t}`]);
    }),
    { seed: 1337, numRuns: 25 },
  );
});

test("With `KEEL_REPORT_TOKEN=t` in `io.env` the request to an http route carries `cookie: keel-caller=t`", async () => {
  const seen: (string | null)[] = [];
  const r = await run(["report", "http://h/t", "--format=compact"], {
    cwd: "/work/app",
    files: [],
    env: { KEEL_REPORT_TOKEN: "t" },
    ...recorder(tally, seen),
  });
  expect(r.code).toBe(0);
  expect(seen).toEqual(["keel-caller=t"]);
});

test("Without `KEEL_REPORT_TOKEN` the route request carries no cookie", async () => {
  const seen: (string | null)[] = [];
  const r = await run(["report", "http://h/t?x=1", "--format=compact"], {
    cwd: "/work/app",
    files: [],
    env: {},
    ...recorder(tally, seen),
  });
  expect(r.code).toBe(0);
  expect(seen).toEqual([null]);
});

test("a `url` without path or query gets no cookie even with `KEEL_REPORT_TOKEN` set", async () => {
  for (const url of ["http://h", "https://h", "http://h/"]) {
    const seen: (string | null)[] = [];
    await run(["report", url, "--format=compact"], {
      cwd: "/work/app",
      files: [],
      env: { KEEL_REPORT_TOKEN: "t" },
      ...recorder(inspectDoc, seen),
    });
    expect(seen).toEqual([null]);
  }
});
