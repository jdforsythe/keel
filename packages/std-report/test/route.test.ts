// `keel report` beyond the conformance clauses: which urls are the inspect form and which the route form, what each
// request carries, and what an E1056 names.
import { run } from "@keel/cli";
import { tallyOf } from "@keel/std-report";
import "@keel/std-report/tools";
import { describe, expect, it } from "vitest";

type Seen = { url: string; headers: Record<string, string> };

const inspectDoc = { live: false, graph: { nodes: [], edges: [] }, stores: {}, ids: {}, a11y: {}, routes: {} };
const tally = tallyOf("a", ["x", "x", "y"]);

const io = (body: unknown, seen: Seen[], env: Record<string, string> = {}, status = 200) => ({
  cwd: "/work/app",
  files: [],
  env,
  fetch: (url: string, init?: RequestInit): Promise<Response> => {
    seen.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  },
});

const report = async (url: string, body: unknown, env?: Record<string, string>, status?: number) => {
  const seen: Seen[] = [];
  const r = await run(["report", url, "--format=compact"], io(body, seen, env, status));
  return { ...r, seen };
};

describe("keel report, the inspect form", () => {
  it("is a bare host, with or without trailing slashes, an empty query or a fragment", async () => {
    for (const url of ["http://h", "http://h/", "http://h//", "http://h/?", "http://h/#top", "http://h#top"]) {
      const r = await report(url, inspectDoc, { KEEL_REPORT_TOKEN: "t" });
      expect(r.seen).toEqual([{ url: "http://h/__keel/inspect", headers: {} }]);
      expect(r).toMatchObject({ code: 0, stdout: "ok report 0 tallies\n" });
    }
  });

  it("does not read a tally served at the origin", async () => {
    const r = await report("http://h/", tally);
    expect(r).toMatchObject({
      code: 1,
      stdout: "E1056 not an inspect document: http://h\n  see: keel docs k.inspect\nfail report\n",
    });
  });

  it("keeps a url that does not parse in this form and names it without its query", async () => {
    const r = await report("not a url?k=v", inspectDoc);
    expect(r.seen.map((x) => x.url)).toEqual(["not a url/__keel/inspect"]);
    const down = { cwd: "/work/app", files: [], fetch: (): Promise<Response> => Promise.reject(new Error("down")) };
    expect((await run(["report", "not a url?k=v", "--format=compact"], down)).stdout).toBe(
      "E1056 report target unreachable: not a url\n  see: keel docs k.inspect\nfail report\n",
    );
  });
});

describe("keel report, the route form", () => {
  it("fetches a base path over https as given, with the token as the __Host- cookie", async () => {
    for (const url of ["https://h/base", "https://h/base/", "HTTPS://h/base", "https://h?x=1"]) {
      const r = await report(url, tally, { KEEL_REPORT_TOKEN: "t0k" });
      expect(r.seen).toEqual([{ url, headers: { accept: "application/json", cookie: "__Host-keel-caller=t0k" } }]);
      expect(r).toMatchObject({ code: 0, stdout: "a x=2 y=1\nok report 1 tallies\n" });
    }
  });

  it("sends no cookie for an empty or absent KEEL_REPORT_TOKEN, and never another variable's value", async () => {
    for (const env of [{ KEEL_REPORT_TOKEN: "" }, {}, { KEEL_SESSIONS_TOKEN: "s" }]) {
      const r = await report("http://h/t", [tally], env);
      expect(r.seen).toEqual([{ url: "http://h/t", headers: { accept: "application/json" } }]);
      expect(r.code).toBe(0);
    }
  });

  it("names the reason and the url without query or fragment in E1056, cut to 48 characters", async () => {
    expect((await report("http://h/t?k=v#f", {}, {}, 404)).stdout).toBe(
      "E1056 report target answered 404: http://h/t\n  see: keel docs k.inspect\nfail report\n",
    );
    for (const body of [{}, null, 3, "a", { ...tally, extra: 1 }, [tally, { ...tally, id: "" }], [[tally]]]) {
      expect((await report("http://h/t?k=v", body)).stdout).toBe(
        "E1056 not a tally or an array of them: http://h/t\n  see: keel docs k.inspect\nfail report\n",
      );
    }
    const long = `http://h/${"a".repeat(40)}`;
    expect((await report(`${long}?k=v`, {})).stdout).toContain(`of them: http://h/${"a".repeat(36)}...\n`);
  });

  it("reads a loader's answer by the route id it names, whatever else `results` and the answer hold", async () => {
    const other = tallyOf("z", ["q"]);
    const bodies = [
      { id: "r", results: { r: { ok: true, value: tally } } },
      { id: "r", results: { r: { ok: true, value: [tally] } } },
      { id: "r", results: { a: { ok: true, value: other }, r: { ok: true, value: tally }, z: { ok: false } } },
      { id: "r", results: { r: { ok: true, value: tally, extra: 1 } }, more: [other] },
      { id: "", results: { "": { ok: true, value: tally } } },
    ];
    for (const body of bodies) {
      const r = await report("http://h/t?k=v", body);
      expect(r).toMatchObject({ code: 0, stdout: "a x=2 y=1\nok report 1 tallies\n" });
      expect(r.seen.map((x) => x.url)).toEqual(["http://h/t?k=v"]);
    }
    const two = await report("http://h/t", { id: "r", results: { r: { ok: true, value: [other, tally] } } });
    expect(two.stdout).toBe("z q=1\na x=2 y=1\nok report 2 tallies\n");
    const none = await report("http://h/t", { id: "r", results: { r: { ok: true, value: [] } } });
    expect(none.stdout).toBe("ok report 0 tallies\n");
  });

  it("answers E1056 for a loader's answer that holds no tally under its own id", async () => {
    const ok = { ok: true, value: tally };
    const bodies = [
      { id: "r", results: {} },
      { id: "r", results: { other: ok } },
      { id: 1, results: { 1: ok } },
      { id: ["r"], results: { r: ok } },
      { results: { r: ok } },
      { id: "r" },
      { id: "r", results: [ok] },
      { id: "r", results: ok },
      { id: "r", results: { r: tally } },
      { id: "r", results: { r: { value: tally } } },
      { id: "r", results: { r: { ok: 1, value: tally } } },
      { id: "r", results: { r: { ok: false, value: tally } } },
      { id: "r", results: { r: { ok: false, error: { code: "keel.denied", message: "no", data: null } } } },
      { id: "r", results: { r: { ok: true } } },
      { id: "r", results: { r: { ok: true, value: null } } },
      { id: "r", results: { r: { ok: true, value: { ...tally, extra: 1 } } } },
      { id: "r", results: { r: { ok: true, value: [tally, { ...tally, id: "" }] } } },
      { id: "r", results: { r: { ok: true, value: { id: "r", results: { r: ok } } } } },
      { id: "r", results: { r: { ok: true, value: ok } } },
      { id: "toString", results: {} },
      [{ id: "r", results: { r: ok } }],
    ];
    for (const body of bodies) {
      expect((await report("http://h/t?k=v", body)).stdout).toBe(
        "E1056 not a tally or an array of them: http://h/t\n  see: keel docs k.inspect\nfail report\n",
      );
    }
  });

  it("reads no loader's answer in the inspect form", async () => {
    const r = await report("http://h", { id: "r", results: { r: { ok: true, value: tally } } });
    expect(r.stdout).toBe("E1056 not an inspect document: http://h\n  see: keel docs k.inspect\nfail report\n");
  });

  it("prints the token in no output, whatever the answer", async () => {
    const env = { KEEL_REPORT_TOKEN: "s3cr3tvalue" };
    const down = { cwd: "/work/app", files: [], env, fetch: (): Promise<Response> => Promise.reject(new Error("x")) };
    const runs = [
      await report("https://h/t", tally, env),
      await report("https://h/t", "<html>", env),
      await report("https://h/t", {}, env, 403),
      await run(["report", "https://h/t", "--format=json"], down),
    ];
    for (const r of runs) expect(r.stdout + r.stderr).not.toContain("s3cr3tvalue");
  });
});
