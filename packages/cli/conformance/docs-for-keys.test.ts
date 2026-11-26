// Spec: k.docs, clause "With installed sections `k.x` citing E1551 and E1553 and `k.y` citing E1551 and E1501, `keel docs --for E155x` emits `docs.code` E1551 with `ids` `[\"k.x\",\"k.y\"]`, then E1553 with `[\"k.x\"]`, and nothing for E1501, exit 0; `--for E15xx` adds E1501."
// Spec: k.docs, clause "With `k.x` holding `` `renderRoute(id)` `` and `` `t.renderRoute` ``, `k.y` holding `` `renderRoute` `` once and `k.z` holding only `` `renderRouter` ``, `keel docs --for renderRoute` emits `docs.hit` for `k.x` with `count` 2, then `k.y` with 1, and none for `k.z`; a name in plain text outside backticks counts no span."
// Spec: k.docs, clause "With `glossary.json` term `identity mount`, `keel docs --for \"Identity Mount\"` emits that `docs.term` first, then its hits; `keel docs --for nothing-here` prints no record, exit 0."
// The Forms paragraph also says: a key matches a glossary term and a code span ignoring case; a key matching nothing prints only the trailing `summary` record, exit 0. Not Conformance bullets, so no citation; the cases below under the identity mount clause hold them.
// Seed 1337 (the block, ranking and cut properties). Red: `docs` is absent (E1051), then `--for` takes codes only.
// ASSUMED: a section "cites" a code when its `index.json` `codes` lists it (k.docs Packed files); the fixtures list each cited code there.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, type Files, cliPkg, jsonRecords, lines, pkg, project, run } from "./docs-support";

const sec = (id: string, codes: string[], text = ""): { id: string; title: string; codes: string[]; text: string } => ({
  id,
  title: `Title ${id}`,
  codes,
  text: `# ${id}: Title ${id}\nstatus: implemented\n${codes.map((c) => `${c} cited.\n`).join("")}${text}`,
});
const filesFor = (
  sections: { id: string; title: string; codes: string[]; text: string }[],
  terms: { term: string; text: string; ids: string[] }[] = [],
): Files => [
  ...project(["cli", "router"]),
  ...cliPkg(
    sections.map((s) => ({ id: s.id, title: s.title, package: "@keel/router", area: "a" })),
    [],
    { terms },
  ),
  ...pkg("router", "2.0.0", sections),
];

describe("k.docs --for a code block", () => {
  const files = filesFor([sec("k.x", ["E1551", "E1553"]), sec("k.y", ["E1551", "E1501"])]);

  it("`--for E155x` emits docs.code E1551 with ids [k.x, k.y], then E1553 with [k.x], and nothing for E1501, exit 0", async () => {
    const r = await jsonRecords(["docs", "--for", "E155x"], files);
    expect(r.code).toBe(0);
    const recs = r.recs.filter((x) => x.kind !== "summary");
    expect(recs).toHaveLength(2);
    expect(recs[0]).toMatchObject({ kind: "docs.code", code: "E1551", ids: ["k.x", "k.y"] });
    expect(recs[1]).toMatchObject({ kind: "docs.code", code: "E1553", ids: ["k.x"] });
    expect(r.out).not.toContain("E1501");
  });

  it("`--for E15xx` adds E1501", async () => {
    const r = await jsonRecords(["docs", "--for", "E15xx"], files);
    expect(r.code).toBe(0);
    const codes = r.recs.filter((x) => x.kind === "docs.code");
    expect(codes.map((c) => c.code)).toEqual(["E1501", "E1551", "E1553"]);
    expect(codes[0]).toMatchObject({ ids: ["k.y"] });
  });

  it("`--for <block>` emits exactly the cited codes of the block in code order, each with its citing sections in map order", async () => {
    const code = fc.integer({ min: 1500, max: 1699 }).map((n) => `E${n}`);
    const cites = fc.array(fc.uniqueArray(code, { maxLength: 6 }), { minLength: 1, maxLength: 4 });
    await fc.assert(
      fc.asyncProperty(cites, async (per) => {
        const secs = per.map((codes, i) => sec(`k.s${i}`, codes));
        const r = await jsonRecords(["docs", "--for", "E155x"], filesFor(secs));
        expect(r.code).toBe(0);
        const want = [...new Set(per.flat())].filter((c) => c.startsWith("E155")).sort();
        const got = r.recs.filter((x) => x.kind === "docs.code");
        expect(got.map((c) => c.code)).toEqual(want);
        for (const g of got)
          expect(g.ids).toEqual(secs.filter((s) => s.codes.includes(String(g.code))).map((s) => s.id));
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});

describe("k.docs --for an API name", () => {
  const span = (n: number, name: string): string =>
    `${Array.from({ length: n }, () => `\`${name}\``).join(" and ")}.\n`;
  const files = filesFor([
    sec("k.x", [], "Use `renderRoute(id)` and `t.renderRoute`.\n"),
    sec("k.y", [], span(1, "renderRoute")),
    sec("k.z", [], span(1, "renderRouter")),
    sec("k.w", [], "renderRoute in plain text, and a renderRoute here.\n"),
  ]);

  it("`--for renderRoute` emits docs.hit for k.x with count 2, then k.y with 1, and none for k.z", async () => {
    const r = await jsonRecords(["docs", "--for", "renderRoute"], files);
    expect(r.code).toBe(0);
    const hits = r.recs.filter((x) => x.kind === "docs.hit");
    expect(hits.map((h) => [h.id, h.count])).toEqual([
      ["k.x", 2],
      ["k.y", 1],
    ]);
    expect(hits[0]).toMatchObject({ name: "renderRoute", title: "Title k.x", package: "@keel/router" });
    expect(r.recs.some((x) => x.kind === "docs.term")).toBe(false);
  });

  it("a name in plain text outside backticks counts no span", async () => {
    const r = await jsonRecords(["docs", "--for", "renderRoute"], files);
    expect(r.recs.some((x) => x.kind === "docs.hit" && x.id === "k.w")).toBe(false);
  });

  it("compact `--for <name>` prints `<id> <title> <count>`", async () => {
    const r = await run(["docs", "--for", "renderRoute", "--format=compact"], { files });
    expect(lines(r.stdout).filter((l) => !l.startsWith("ok "))).toEqual(["k.x Title k.x 2", "k.y Title k.y 1"]);
  });

  it("hits run by count, most first, then map order, at most 5", async () => {
    const counts = fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 9 });
    await fc.assert(
      fc.asyncProperty(counts, async (cs) => {
        const secs = cs.map((n, i) => sec(`k.s${i}`, [], n === 0 ? "none\n" : span(n, "pick")));
        const r = await jsonRecords(["docs", "--for", "pick"], filesFor(secs));
        const want = cs
          .map((n, i) => ({ id: `k.s${i}`, n, i }))
          .filter((e) => e.n > 0)
          .sort((p, q) => q.n - p.n || p.i - q.i)
          .slice(0, 5);
        expect(r.recs.filter((x) => x.kind === "docs.hit").map((h) => [h.id, h.count])).toEqual(
          want.map((e) => [e.id, e.n]),
        );
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});

describe("k.docs --for a glossary term", () => {
  const term = { term: "identity mount", text: "The place an identity library is mounted.", ids: ["k.x"] };
  const files = filesFor([sec("k.x", [], "Set the `Identity Mount` up.\n"), sec("k.y", [])], [term]);

  it('`--for "Identity Mount"` emits the identity mount docs.term first, then its hits', async () => {
    const r = await jsonRecords(["docs", "--for", "Identity Mount"], files);
    expect(r.code).toBe(0);
    const recs = r.recs.filter((x) => x.kind !== "summary");
    expect(recs[0]).toMatchObject({ kind: "docs.term", term: "identity mount", text: term.text, ids: ["k.x"] });
    expect(recs.slice(1).every((x) => x.kind === "docs.hit")).toBe(true);
    expect(recs.slice(1).map((h) => h.id)).toEqual(["k.x"]);
  });

  it("the term's text is cut at 160 characters", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 400 }), async (n) => {
        const text = "t".repeat(n);
        const r = await jsonRecords(
          ["docs", "--for", "identity mount"],
          filesFor([sec("k.x", [])], [{ ...term, text }]),
        );
        expect(r.recs[0]).toMatchObject({ kind: "docs.term", text: text.slice(0, 160) });
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`--for nothing-here` prints no record, exit 0", async () => {
    const r = await jsonRecords(["docs", "--for", "nothing-here"], files);
    expect(r.code).toBe(0);
    expect(r.recs.filter((x) => x.kind !== "summary")).toEqual([]);
    expect(r.recs.map((x) => x.kind)).toEqual(["summary"]);
    const c = await run(["docs", "--for", "nothing-here", "--format=compact"], { files });
    expect(c.code).toBe(0);
    expect(lines(c.stdout).filter((l) => !l.startsWith("ok "))).toEqual([]);
  });

  it("a key matches a glossary term and a code span ignoring case", async () => {
    const r = await jsonRecords(["docs", "--for", "IDENTITY mount"], files);
    expect(r.recs.find((x) => x.kind === "docs.term")).toMatchObject({ term: "identity mount" });
    expect(r.recs.filter((x) => x.kind === "docs.hit").map((h) => h.id)).toEqual(["k.x"]);
    const spans = filesFor([sec("k.x", [], "Use `RenderRoute(id)`.\n")]);
    const s = await jsonRecords(["docs", "--for", "renderroute"], spans);
    expect(s.recs.filter((x) => x.kind === "docs.hit").map((h) => [h.id, h.count])).toEqual([["k.x", 1]]);
  });

  it("a key that matches nothing prints only the trailing summary record, exit 0", async () => {
    const r = await jsonRecords(["docs", "--for", "nothing-here"], files);
    expect(r.code).toBe(0);
    expect(r.recs.map((x) => x.kind)).toEqual(["summary"]);
  });
});
