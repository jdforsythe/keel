// @vitest-environment happy-dom
// Resume of list and match: server content the client does not render is a mismatch (E1253); content it does is claimed.
import { describe, expect, it } from "vitest";
import { clone, list, match, resume, template } from "../src/ops/index.ts";
import { testCtx } from "./testCtx.ts";

const ROOT = template('<div data-k-island="E"><ul><!----></ul></div>');
const LI = template("<li>row</li>");
const NONE = template('<li class="e">none</li>');
const CASE = template('<li class="c">case</li>');
const anchorIn = (root: Node): Node => {
  const ul = root instanceof Element ? root.querySelector("ul") : null;
  const a = ul?.lastChild;
  if (a === null || a === undefined) throw new Error("fixture: no anchor");
  return a;
};
const kState = `<script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { E: {} } })}</script>`;
const page = (inner: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = `<div data-k-island="E"><ul>${inner}<!----></ul></div>${kState}`;
  return host;
};
const region = (s: string): string => `<!--[-->${s}<!--]-->`;

const emptyList = (withEmpty: boolean) => (): Node => {
  const root = clone(ROOT);
  list(
    anchorIn(root),
    (): string[] => [],
    (k) => k,
    () => clone(LI),
    withEmpty ? () => clone(NONE) : undefined,
  );
  return root;
};
const tagged = (tag: string) => (): Node => {
  const root = clone(ROOT);
  match(anchorIn(root), () => ({ tag }), "tag", { yes: () => clone(CASE) });
  return root;
};
const oneRow = (): Node => {
  const root = clone(ROOT);
  list(
    anchorIn(root),
    () => ["a"],
    (k) => k,
    () => clone(LI),
  );
  return root;
};

describe("resume: list", () => {
  it("an empty list with no `empty` and a server row is a mismatch; with an empty server region it is claimed", () => {
    const stale = page(region("<li>row</li>"));
    const bad = resume(stale, { E: emptyList(false) }, { ctx: testCtx });
    expect(bad.warnings).toHaveLength(1);
    expect(bad.warnings[0]).toMatch(/^E1253 /);
    expect(stale.querySelectorAll("li")).toHaveLength(0);

    const exact = page(region(""));
    const ul = exact.querySelector("ul");
    const before = [...(ul?.childNodes ?? [])];
    expect(resume(exact, { E: emptyList(false) }, { ctx: testCtx }).warnings).toEqual([]);
    expect([...(ul?.childNodes ?? [])]).toEqual(before);
  });

  it("an empty list with `empty` claims the server's empty content and flags anything after it", () => {
    const exact = page(region('<li class="e">none</li>'));
    const li = exact.querySelector("li");
    expect(resume(exact, { E: emptyList(true) }, { ctx: testCtx }).warnings).toEqual([]);
    expect(exact.querySelector("li")).toBe(li);

    const extra = page(region('<li class="e">none</li><li>stale</li>'));
    const bad = resume(extra, { E: emptyList(true) }, { ctx: testCtx });
    expect(bad.warnings).toHaveLength(1);
    expect(bad.warnings[0]).toMatch(/^E1253 /);
    expect(extra.querySelectorAll("li")).toHaveLength(1);
  });

  it("rows claim their server nodes and a surplus server row is a mismatch", () => {
    const exact = page(region("<li>row</li>"));
    const li = exact.querySelector("li");
    expect(resume(exact, { E: oneRow }, { ctx: testCtx }).warnings).toEqual([]);
    expect(exact.querySelector("li")).toBe(li);

    const extra = page(region("<li>row</li><li>row</li>"));
    const bad = resume(extra, { E: oneRow }, { ctx: testCtx });
    expect(bad.warnings).toHaveLength(1);
    expect(extra.querySelectorAll("li")).toHaveLength(1);
  });
});

describe("resume: match", () => {
  it("a case claims its server content and a surplus server node is a mismatch", () => {
    const exact = page(region('<li class="c">case</li>'));
    const li = exact.querySelector("li");
    expect(resume(exact, { E: tagged("yes") }, { ctx: testCtx }).warnings).toEqual([]);
    expect(exact.querySelector("li")).toBe(li);

    const extra = page(region('<li class="c">case</li><li>stale</li>'));
    const bad = resume(extra, { E: tagged("yes") }, { ctx: testCtx });
    expect(bad.warnings).toHaveLength(1);
    expect(bad.warnings[0]).toMatch(/^E1253 /);
    expect(extra.querySelectorAll("li")).toHaveLength(1);
  });

  it("a tag with no case renders nothing: server content there is a mismatch, an empty region is claimed", () => {
    const stale = page(region('<li class="c">case</li>'));
    const bad = resume(stale, { E: tagged("none") }, { ctx: testCtx });
    expect(bad.warnings).toHaveLength(1);
    expect(bad.warnings[0]).toMatch(/^E1253 /);
    expect(stale.querySelectorAll("li")).toHaveLength(0);

    const exact = page(region(""));
    expect(resume(exact, { E: tagged("none") }, { ctx: testCtx }).warnings).toEqual([]);
  });
});
