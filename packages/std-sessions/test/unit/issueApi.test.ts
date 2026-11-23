// `issueApi`: the GitHub REST calls of the sessions Action over a scripted fetch. What each call sends, how `find`
// pages through open and closed issues, where `lastComment` reads, and the one reason each failure gives, which
// never holds the token or a response body.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { issueApi } from "../../src/internal/issueApi.ts";

const API = "https://api.github.test";
const BASE = `${API}/repos/acme/shop/issues`;
const TOKEN = "ghs_t0ken";
type Asked = { url: string; method: string | undefined; headers: unknown; body: unknown };
type Reply = Response | Error | ((url: string) => Response | Error);

/** An api whose fetch answers from `replies` in turn (the last one repeats) and notes each request. */
function api(...replies: Reply[]) {
  const asked: Asked[] = [];
  let n = 0;
  const calls = issueApi(
    {
      fetch: async (url, init) => {
        asked.push({
          url,
          method: init?.method,
          headers: init?.headers,
          body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
        });
        const reply = replies[Math.min(n++, replies.length - 1)];
        const made = typeof reply === "function" ? reply(url) : reply;
        if (made === undefined || made instanceof Error) throw made ?? new Error("no reply");
        return made;
      },
    },
    API,
    "acme/shop",
    TOKEN,
  );
  return { calls, asked };
}
const json = (body: unknown, init: { status?: number; link?: string } = {}): Response =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    ...(init.link === undefined ? {} : { headers: { link: init.link } }),
  });
const issue = (number: number, over: Record<string, unknown> = {}) => ({
  number,
  title: `t${number}`,
  body: `b${number}`,
  ...over,
});
const HEADERS = {
  accept: "application/vnd.github+json",
  authorization: `Bearer ${TOKEN}`,
  "content-type": "application/json",
  "user-agent": "keel-session-action",
  "x-github-api-version": "2022-11-28",
};
const OPEN = `${BASE}?state=open&labels=keel-session&per_page=100`;
const CLOSED = `${BASE}?state=closed&sort=updated&direction=desc&labels=keel-session&per_page=100`;

describe("issueApi: create, update, comment", () => {
  test("create posts the title, body and label and answers the new issue's number", async () => {
    const { calls, asked } = api(json({ number: 12, title: "ignored" }, { status: 201 }));
    expect(await calls.create("keel-session", "session 7f: cart.full", "the body")).toEqual({ ok: true, value: 12 });
    expect(asked).toEqual([
      {
        url: BASE,
        method: "POST",
        headers: HEADERS,
        body: { title: "session 7f: cart.full", body: "the body", labels: ["keel-session"] },
      },
    ]);
  });

  test("update patches the issue; comment posts to its comments", async () => {
    const a = api(json({ number: 12 }));
    expect(await a.calls.update(12, "new title", "new body")).toEqual({ ok: true, value: 12 });
    expect(a.asked).toEqual([
      { url: `${BASE}/12`, method: "PATCH", headers: HEADERS, body: { title: "new title", body: "new body" } },
    ]);
    const b = api(json({ number: 99 }, { status: 201 }));
    expect(await b.calls.comment(12, "still failing")).toEqual({ ok: true, value: 99 });
    expect(b.asked).toEqual([
      { url: `${BASE}/12/comments`, method: "POST", headers: HEADERS, body: { body: "still failing" } },
    ]);
  });

  test("each failure names the call and what happened, never the token or the response", async () => {
    const reasons = async (reply: Reply) => {
      const out: unknown[] = [];
      for (const call of [
        (c: ReturnType<typeof api>["calls"]) => c.create("l", "t", "b"),
        (c: ReturnType<typeof api>["calls"]) => c.update(1, "t", "b"),
        (c: ReturnType<typeof api>["calls"]) => c.comment(1, "b"),
      ])
        out.push(await call(api(reply).calls));
      return out;
    };
    expect(await reasons(new Error(`connect failed for ${TOKEN}`))).toEqual([
      { ok: false, why: "github issue create unreachable" },
      { ok: false, why: "github issue update unreachable" },
      { ok: false, why: "github issue comment unreachable" },
    ]);
    expect(await reasons(() => json({ message: `Bad credentials ${TOKEN}`, number: 5 }, { status: 401 }))).toEqual([
      { ok: false, why: "github issue create answered 401" },
      { ok: false, why: "github issue update answered 401" },
      { ok: false, why: "github issue comment answered 401" },
    ]);
    for (const body of [
      () => json({ id: 5 }),
      () => json({ number: "5" }),
      () => json({ number: 1.5 }),
      () => json(null),
      () => new Response("<html>"),
    ])
      expect(await reasons(body)).toEqual([
        { ok: false, why: "github issue create answered without a number" },
        { ok: false, why: "github issue update answered without a number" },
        { ok: false, why: "github issue comment answered without a number" },
      ]);
  });
});

describe("issueApi: find", () => {
  test("lists open issues, then closed ones newest first, with the label encoded and no body sent", async () => {
    const { calls, asked } = api(json([issue(1)]), json([issue(2, { state: "closed" })]));
    const found = await calls.find("keel-session");
    expect(asked).toEqual([
      { url: OPEN, method: "GET", headers: HEADERS, body: undefined },
      { url: CLOSED, method: "GET", headers: HEADERS, body: undefined },
    ]);
    expect(found).toEqual({
      ok: true,
      value: [
        { number: 1, title: "t1", body: "b1", status: "open" },
        { number: 2, title: "t2", body: "b2", status: "completed" },
      ],
    });
    const odd = api(json([]));
    await odd.calls.find("a label/&x");
    expect(odd.asked[0]?.url).toBe(`${BASE}?state=open&labels=a%20label%2F%26x&per_page=100`);
  });

  test("status: open unless closed; closed as not planned is not_planned, any other closing is completed", async () => {
    const { calls } = api(
      json([
        issue(1, { state: "open" }),
        issue(2),
        issue(3, { state: "closed", state_reason: "not_planned" }),
        issue(4, { state: "closed", state_reason: "completed" }),
        issue(5, { state: "closed", state_reason: null }),
        issue(6, { state: "closed" }),
        issue(7, { state: "open", state_reason: "not_planned" }),
        issue(8, { state: "other" }),
      ]),
      json([]),
    );
    const found = await calls.find("l");
    expect(found.ok && found.value.map((i) => i.status)).toEqual([
      "open",
      "open",
      "not_planned",
      "completed",
      "completed",
      "completed",
      "open",
      "open",
    ]);
  });

  test("a pull request is dropped; a null or missing body is the empty string; other fields are ignored", async () => {
    const { calls } = api(
      json([
        issue(1, { pull_request: { url: "x" } }),
        issue(3, { body: null }),
        { number: 4, title: "t4", labels: ["x"], user: { login: "u" } },
      ]),
      json([]),
    );
    expect(await calls.find("l")).toEqual({
      ok: true,
      value: [
        { number: 3, title: "t3", body: "", status: "open" },
        { number: 4, title: "t4", body: "", status: "open" },
      ],
    });
  });

  test("follows rel=next while it stays under the api, for open and for closed issues", async () => {
    const next = (url: string): string => `<${url}>; rel="next", <${API}/last>; rel="last"`;
    const { calls, asked } = api(
      json([issue(1)], { link: next(`${API}/open-2`) }),
      json([issue(2)], { link: `<${API}/prev>; rel="prev",<${API}/open-3>;rel="next"` }),
      json([issue(3)], { link: `<${API}/open-2>; rel="prev"` }),
      json([issue(4, { state: "closed" })], { link: next(`${API}/closed-2`) }),
      json([issue(5, { state: "closed" })]),
    );
    const found = await calls.find("keel-session");
    expect(asked.map((a) => a.url)).toEqual([OPEN, `${API}/open-2`, `${API}/open-3`, CLOSED, `${API}/closed-2`]);
    expect(found.ok && found.value.map((i) => i.number)).toEqual([1, 2, 3, 4, 5]);
  });

  test("a next link that leaves the api is not followed", async () => {
    for (const link of [
      '<https://evil.test/issues?page=2>; rel="next"',
      `<${API}.evil.test/issues?page=2>; rel="next"`,
      `<${API}>; rel="next"`,
      `<x${API}/page-2>; rel="next"`,
    ]) {
      const { calls, asked } = api(json([issue(1)], { link }), json([]));
      expect((await calls.find("keel-session")).ok, link).toBe(true);
      expect(
        asked.map((a) => a.url),
        link,
      ).toEqual([OPEN, CLOSED]);
    }
  });

  test("open issues past 50 pages are a failure; closed issues stop after 5 pages without one", async () => {
    const endless = (url: string): Response =>
      json([issue(1)], { link: `<${API}/more?from=${encodeURIComponent(url).length}>; rel="next"` });
    const open = api(endless);
    expect(await open.calls.find("keel-session")).toEqual({ ok: false, why: "github issues list exceeded 50 pages" });
    expect(open.asked).toHaveLength(50);
    let closedPages = 0;
    const closed = api((url) => {
      if (url === OPEN) return json([issue(1)]);
      closedPages++;
      return json([issue(100 + closedPages, { state: "closed" })], {
        link: `<${API}/closed-${closedPages + 1}>; rel="next"`,
      });
    });
    const found = await closed.calls.find("keel-session");
    expect(closedPages).toBe(5);
    expect(found.ok && found.value.map((i) => i.number)).toEqual([1, 101, 102, 103, 104, 105]);
  });

  test("exactly 50 pages of open issues are read whole", async () => {
    let page = 0;
    const { calls, asked } = api((url) => {
      if (url === CLOSED) return json([]);
      page++;
      return json([issue(page)], page < 50 ? { link: `<${API}/open-${page + 1}>; rel="next"` } : {});
    });
    const found = await calls.find("keel-session");
    expect(found.ok && found.value).toHaveLength(50);
    expect(asked).toHaveLength(51);
  });

  test("each failure is its reason and nothing found so far is returned", async () => {
    const onSecondPage = async (second: Reply) =>
      await api(json([issue(1)], { link: `<${API}/open-2>; rel="next"` }), second).calls.find("l");
    expect(await api(new Error("down")).calls.find("l")).toEqual({ ok: false, why: "github issues list unreachable" });
    expect(await onSecondPage(json({ message: "rate limited" }, { status: 403 }))).toEqual({
      ok: false,
      why: "github issues list answered 403",
    });
    for (const body of [
      json({ items: [] }),
      json(null),
      new Response("<html>"),
      json([{ title: "no number" }]),
      json([{ number: 1 }]),
      json([issue(1, { body: 5 })]),
    ])
      expect(await onSecondPage(body)).toEqual({ ok: false, why: "github issues list answered without a list" });
    expect(await api(json([issue(1)]), json({}, { status: 500 })).calls.find("l")).toEqual({
      ok: false,
      why: "github issues list answered 500",
    });
  });

  test("property: every issue of every page comes back once, open ones first", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.nat(4), { minLength: 1, maxLength: 5 }),
        fc.array(fc.nat(4), { minLength: 1, maxLength: 4 }),
        async (open, closed) => {
          let number = 0;
          const pages = (sizes: number[], state: string, name: string): Response[] =>
            sizes.map((size, i) =>
              json(
                Array.from({ length: size }, () => issue(++number, { state })),
                i + 1 < sizes.length ? { link: `<${API}/${name}-${i + 2}>; rel="next"` } : {},
              ),
            );
          const { calls } = api(...pages(open, "open", "open"), ...pages(closed, "closed", "closed"));
          const found = await calls.find("l");
          expect(found.ok && found.value.map((i) => i.number)).toEqual(Array.from({ length: number }, (_, i) => i + 1));
          expect(found.ok && found.value.filter((i) => i.status === "open")).toHaveLength(
            open.reduce((a, b) => a + b, 0),
          );
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });
});

describe("issueApi: lastComment", () => {
  const COMMENTS = `${BASE}/12/comments?per_page=100`;

  test("the body of the newest comment of the only page; null with no comment or a null body", async () => {
    const one = api(json([{ body: "first" }, { body: "second", user: "u" }]));
    expect(await one.calls.lastComment(12)).toEqual({ ok: true, value: "second" });
    expect(one.asked).toEqual([{ url: COMMENTS, method: "GET", headers: HEADERS, body: undefined }]);
    expect(await api(json([])).calls.lastComment(12)).toEqual({ ok: true, value: null });
    expect(await api(json([{ body: "first" }, { body: null }])).calls.lastComment(12)).toEqual({
      ok: true,
      value: null,
    });
    expect(await api(json([{ body: "first" }, {}])).calls.lastComment(12)).toEqual({ ok: true, value: null });
    expect(await api(json([{ body: "only" }])).calls.lastComment(12)).toEqual({ ok: true, value: "only" });
  });

  test("with a rel=last page under the api, the comment is read from that page", async () => {
    const link = `<${API}/comments?page=2>; rel="next", <${API}/comments?page=7>; rel="last"`;
    const { calls, asked } = api(json([{ body: "page one" }], { link }), json([{ body: "older" }, { body: "newest" }]));
    expect(await calls.lastComment(12)).toEqual({ ok: true, value: "newest" });
    expect(asked.map((a) => [a.url, a.method])).toEqual([
      [COMMENTS, "GET"],
      [`${API}/comments?page=7`, "GET"],
    ]);
    const outside = api(json([{ body: "page one" }], { link: '<https://evil.test/c?page=7>; rel="last"' }));
    expect(await outside.calls.lastComment(12)).toEqual({ ok: true, value: "page one" });
    expect(outside.asked).toHaveLength(1);
    const onlyNext = api(json([{ body: "page one" }], { link: `<${API}/comments?page=2>; rel="next"` }));
    expect(await onlyNext.calls.lastComment(12)).toEqual({ ok: true, value: "page one" });
  });

  test("each failure is its reason, on the first page or the last", async () => {
    const link = `<${API}/comments?page=7>; rel="last"`;
    expect(await api(new Error("down")).calls.lastComment(12)).toEqual({
      ok: false,
      why: "github comments list unreachable",
    });
    expect(await api(json([], { status: 404 })).calls.lastComment(12)).toEqual({
      ok: false,
      why: "github comments list answered 404",
    });
    expect(await api(json([{ body: "one" }], { link }), new Error("down")).calls.lastComment(12)).toEqual({
      ok: false,
      why: "github comments list unreachable",
    });
    expect(await api(json([{ body: "one" }], { link }), json([], { status: 502 })).calls.lastComment(12)).toEqual({
      ok: false,
      why: "github comments list answered 502",
    });
    for (const body of [
      json({ comments: [] }),
      json(null),
      new Response("<html>"),
      json([{ body: 5 }]),
      json(["text"]),
    ])
      expect(await api(body).calls.lastComment(12)).toEqual({
        ok: false,
        why: "github comments list answered without a list",
      });
  });
});
