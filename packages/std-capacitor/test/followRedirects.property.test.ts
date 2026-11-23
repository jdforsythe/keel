// The redirect follower of a shell's net (k.shell Origins): hops, the method and body rules, the list at every hop.
// A scripted server stands in for the native client. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Hop } from "../src/internal/Hop.ts";
import { followRedirects } from "../src/internal/followRedirects.ts";

const run = { seed: 1337, numRuns: 200 };
const SELF = "https://golden-1.example";
const OTHER = "https://api.example";
type Res = { status: number; headers: Headers };
const res = (status: number, location?: string): Res => ({
  status,
  headers: new Headers(location === undefined ? {} : { location }),
});
/** A server answering from `answer`, recording each hop it was sent and each response dropped. */
function server(answer: (hop: Hop, n: number) => Res) {
  const sent: Hop[] = [];
  const dropped: Res[] = [];
  return {
    sent,
    dropped,
    send: async (hop: Hop): Promise<Res> => {
      sent.push(hop);
      return answer(hop, sent.length);
    },
    drop: (r: Res): void => {
      dropped.push(r);
    },
  };
}
const hop = (method = "GET", headers: Record<string, string> = {}, url = `${SELF}/a`): Hop => ({
  url,
  method,
  headers: new Headers(headers),
  body: method !== "GET" && method !== "HEAD",
});
const anywhere = (): boolean => true;
const listed = (url: string): boolean => [SELF, OTHER].includes(new URL(url).origin);
const status = fc.constantFrom(301, 302, 303, 307, 308);
const method = fc.constantFrom("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE");
const rejected = async (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );

describe("followRedirects", () => {
  test("a response that is no redirect resolves as it came after one request, in every mode", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(200, 204, 300, 304, 305, 306, 399, 404, 500),
        fc.constantFrom<RequestRedirect>("follow", "error", "manual"),
        async (code, mode) => {
          const s = server(() => res(code, "/b"));
          const out = await followRedirects(hop(), mode, anywhere, s.send, s.drop);
          expect(out.status).toBe(code);
          expect(s.sent).toHaveLength(1);
          expect(s.dropped).toEqual([]);
        },
      ),
      run,
    );
  });

  test("`manual` resolves a redirect as it came; `error` rejects it with a TypeError after one request and drops it", async () => {
    await fc.assert(
      fc.asyncProperty(status, fc.boolean(), async (code, located) => {
        const answer = res(code, located ? "/b" : undefined);
        const manual = server(() => answer);
        expect(await followRedirects(hop(), "manual", anywhere, manual.send, manual.drop)).toBe(answer);
        expect(manual.dropped).toEqual([]);
        const error = server(() => answer);
        expect(await rejected(followRedirects(hop(), "error", anywhere, error.send, error.drop))).toBeInstanceOf(
          TypeError,
        );
        expect(error.sent).toHaveLength(1);
        expect(error.dropped).toEqual([answer]);
      }),
      run,
    );
  });

  test("`follow`: n redirects then a 200 are n + 1 requests, each location resolved against its hop, the fragment left out", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 20 }), status, async (n, code) => {
        const s = server((_, i) => (i <= n ? res(code, i % 2 === 0 ? `../d${i}/x#f` : `d${i}/y?q=1`) : res(200)));
        const out = await followRedirects(hop("GET", {}, `${SELF}/r/a`), "follow", anywhere, s.send, s.drop);
        expect(out.status).toBe(200);
        expect(s.sent).toHaveLength(n + 1);
        expect(s.dropped).toHaveLength(n);
        let at = `${SELF}/r/a`;
        for (let i = 1; i <= n; i++) {
          const next = new URL(i % 2 === 0 ? `../d${i}/x` : `d${i}/y?q=1`, at).href;
          expect(s.sent[i]?.url).toBe(next);
          at = next;
        }
      }),
      run,
    );
  });

  test("`follow`: the 21st redirect rejects with a TypeError after 21 requests", async () => {
    const s = server((_, i) => res(302, `/${i}`));
    expect(await rejected(followRedirects(hop(), "follow", anywhere, s.send, s.drop))).toBeInstanceOf(TypeError);
    expect(s.sent).toHaveLength(21);
    expect(s.dropped).toHaveLength(21);
  });

  test("`follow`: a redirect with no location resolves as it came", async () => {
    await fc.assert(
      fc.asyncProperty(status, async (code) => {
        const answer = res(code);
        const s = server(() => answer);
        expect(await followRedirects(hop(), "follow", anywhere, s.send, s.drop)).toBe(answer);
        expect(s.dropped).toEqual([]);
      }),
      run,
    );
  });

  test("`follow`: 303 unless HEAD, and 301 or 302 after POST, continue as a bodiless GET without body headers; any other hop repeats", async () => {
    await fc.assert(
      fc.asyncProperty(status, method, async (code, m) => {
        const s = server((_, i) => (i === 1 ? res(code, "/done") : res(200)));
        const headers = { "content-type": "text/plain", "content-language": "en", "x-keep": "1" };
        await followRedirects(hop(m, headers), "follow", anywhere, s.send, s.drop);
        const second = s.sent[1];
        const get = (code === 303 && m !== "HEAD") || ((code === 301 || code === 302) && m === "POST");
        expect(second?.method).toBe(get ? "GET" : m);
        expect(second?.body).toBe(get ? false : m !== "GET" && m !== "HEAD");
        expect(second?.headers.get("content-type")).toBe(get ? null : "text/plain");
        expect(second?.headers.get("content-language")).toBe(get ? null : "en");
        expect(second?.headers.get("x-keep")).toBe("1");
      }),
      run,
    );
  });

  test("`follow`: a hop to another origin drops authorization and it stays dropped; a hop on the same origin keeps it", async () => {
    await fc.assert(
      fc.asyncProperty(status, fc.boolean(), async (code, cross) => {
        const to = cross ? `${OTHER}/b` : "/b";
        const s = server((_, i) => (i === 1 ? res(code, to) : i === 2 ? res(307, `${SELF}/c`) : res(200)));
        await followRedirects(
          hop("GET", { authorization: "Bearer t", "x-keep": "1" }),
          "follow",
          listed,
          s.send,
          s.drop,
        );
        expect(s.sent.map((h) => h.headers.get("authorization"))).toEqual(
          cross ? ["Bearer t", null, null] : ["Bearer t", "Bearer t", "Bearer t"],
        );
        expect(s.sent.map((h) => h.headers.get("x-keep"))).toEqual(["1", "1", "1"]);
        expect(s.sent[0]?.headers.get("authorization")).toBe("Bearer t");
      }),
      run,
    );
  });

  test("a first URL the list refuses is not sent; a refused hop rejects with a TypeError naming no URL and is not sent", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          "https://evil.example/zq",
          "http://api.example/zq",
          "ftp://api.example/zq",
          "https://api.example:8443/zq",
        ),
        fc.constantFrom<RequestRedirect>("follow", "error", "manual"),
        async (bad, mode) => {
          const first = server(() => res(200));
          const e = await rejected(followRedirects(hop("GET", {}, bad), mode, listed, first.send, first.drop));
          expect(e).toBeInstanceOf(TypeError);
          expect(String(e)).not.toContain("zq");
          expect(String(e)).not.toContain("example");
          expect(first.sent).toEqual([]);
          const later = server((_, i) => (i === 1 ? res(302, bad) : res(200)));
          const followed = await rejected(followRedirects(hop(), "follow", listed, later.send, later.drop));
          expect(followed).toBeInstanceOf(TypeError);
          expect(String(followed)).not.toContain("example");
          expect(later.sent.map((h) => h.url)).toEqual([`${SELF}/a`]);
        },
      ),
      run,
    );
  });

  test("a location that is no URL rejects with a TypeError; a failed send rejects with what it threw", async () => {
    const s = server(() => res(302, "https://"));
    expect(await rejected(followRedirects(hop(), "follow", anywhere, s.send, s.drop))).toBeInstanceOf(TypeError);
    const why = new Error("gone");
    const failing = followRedirects(
      hop(),
      "follow",
      anywhere,
      () => Promise.reject(why),
      () => {},
    );
    expect(await rejected(failing)).toBe(why);
  });
});
