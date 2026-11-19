// `keel report` beyond the conformance clauses: the request it sends, the diagnostics it writes and which sections count.
import { run } from "@keel/cli";
import { tallyOf } from "@keel/std-report";
import "@keel/std-report/tools";
import { describe, expect, it } from "vitest";

const doc = (sections?: Record<string, unknown>) => ({
  live: false,
  graph: { nodes: [], edges: [] },
  stores: {},
  ids: {},
  a11y: {},
  routes: {},
  ...(sections === undefined ? {} : { sections }),
});
const io = (body: unknown, seen: string[] = [], status = 200) => ({
  cwd: "/work/app",
  files: [],
  fetch: (url: string): Promise<Response> => {
    seen.push(url);
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  },
});

describe("keel report", () => {
  it("drops trailing slashes of the url before the inspect path", async () => {
    const seen: string[] = [];
    await run(["report", "http://localhost:4000//", "--format=compact"], io(doc({}), seen));
    expect(seen).toEqual(["http://localhost:4000/__keel/inspect"]);
  });

  it("reads a document without sections as no tallies", async () => {
    const r = await run(["report", "--format=compact"], io(doc()));
    expect(r).toMatchObject({ code: 0, stdout: "ok report 0 tallies\n" });
  });

  it("skips a section that holds an error beside a tally, a tally that fails Tally, and a bare value", async () => {
    const good = tallyOf("m", ["x", "x", "y"]);
    const r = await run(
      ["report", "--format=compact"],
      io(
        doc({
          a: { doc: "t", value: tallyOf("a", ["k"]), error: "E1057 boom" },
          b: { doc: "t", value: { kind: "report.tally", id: "", rows: [] } },
          c: { doc: "t", value: { kind: "report.tally", id: "c", rows: [{ key: "k", n: 0 }] } },
          d: tallyOf("d", ["k"]),
          z: { doc: "t", value: good },
        }),
      ),
    );
    expect(r).toMatchObject({ code: 0, stdout: "m x=2 y=1\nok report 1 tallies\n" });
  });

  it("orders by section id, not by the tally's own id", async () => {
    const r = await run(
      ["report", "--format=compact"],
      io(doc({ b: { doc: "t", value: tallyOf("first", ["k"]) }, a: { doc: "t", value: tallyOf("second", ["k"]) } })),
    );
    expect(r.stdout).toBe("second k=1\nfirst k=1\nok report 2 tallies\n");
  });

  it("names the reason and the url in E1056, the url cut to 48 characters", async () => {
    const down = { cwd: "/work/app", files: [], fetch: (): Promise<Response> => Promise.reject(new Error("down")) };
    expect((await run(["report", "http://localhost:9", "--format=compact"], down)).stdout).toBe(
      "E1056 report target unreachable: http://localhost:9\n  see: k.cli\nfail report\n",
    );
    expect((await run(["report", "--format=compact"], io({}, [], 503))).stdout).toBe(
      "E1056 report target answered 503: http://localhost:5173\n  see: k.cli\nfail report\n",
    );
    expect((await run(["report", "--format=compact"], io({ live: true }))).stdout).toBe(
      "E1056 not an inspect document: http://localhost:5173\n  see: k.cli\nfail report\n",
    );
    const exact = `http://${"a".repeat(41)}`;
    const long = `http://${"a".repeat(42)}`;
    expect((await run(["report", exact, "--format=compact"], down)).stdout).toContain(`unreachable: ${exact}\n`);
    expect((await run(["report", long, "--format=compact"], down)).stdout).toContain(
      `unreachable: http://${"a".repeat(38)}...\n`,
    );
  });

  it("without a network is I1055, exit 0, though the command is filled", async () => {
    const r = await run(["report", "--format=compact"], { cwd: "/work/app", files: [] });
    expect(r).toMatchObject({
      code: 0,
      stdout: "I1055 report not available: needs a network (io.fetch)\n  see: k.cli\nok report\n",
    });
  });

  it("rejects a flag the command does not take with E1052, exit 2", async () => {
    const r = await run(["report", "--failing"], io(doc({})));
    expect(r.code).toBe(2);
    expect(r.stdout + r.stderr).toContain("E1052");
  });
});
