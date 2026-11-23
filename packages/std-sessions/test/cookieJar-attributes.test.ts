// A group user's cookie jar, attribute by attribute: how a `Set-Cookie` line is cut into name, value and attributes,
// which lines are dropped, when a cookie runs out, and the order of the `Cookie` header.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { cookieJar } from "../src/group/internal/cookieJar.ts";

const HTTP = "http://group.test";
const HTTPS = "https://group.test";

describe("group cookie jar: a Set-Cookie line", () => {
  test("name and value are trimmed; the value keeps what follows the first '='", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTP, [" a = one ; Path=/", "b=x=y; Path=/", "c=; Path=/"]);
    expect(jar.header(HTTP)).toBe("a=one; b=x=y; c=");
  });

  test("a line with no name is dropped: no '=', a leading '=', an empty or blank name", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTP, ["novalue; Path=/", "=v; Path=/", "", "  =v; Path=/", "; Path=/"]);
    expect(jar.header(HTTP)).toBe("");
  });

  test("attribute names are case-blind and trimmed; an attribute's value is trimmed", () => {
    const jar = cookieJar(() => 0);
    jar.store(`${HTTP}/deep/page`, ["a=1;  PATH = /api ", "b=2; pAtH=/"]);
    expect(jar.header(`${HTTP}/api/x`)).toBe("a=1; b=2");
    expect(jar.header(`${HTTP}/other`)).toBe("b=2");
  });

  test("a Path that does not start with '/' or has no value is ignored: the default path holds", () => {
    const jar = cookieJar(() => 0);
    jar.store(`${HTTP}/api/lists/new`, ["a=1; Path=lists", "b=2; Path", "c=3; Path="]);
    expect(jar.header(`${HTTP}/api/lists/x`)).toBe("a=1; b=2; c=3");
    expect(jar.header(`${HTTP}/lists`)).toBe("");
    expect(jar.header(`${HTTP}/`)).toBe("");
  });

  test("an attribute that only resembles a known one changes nothing", () => {
    const jar = cookieJar(() => 1_000);
    jar.store(`${HTTP}/api/a`, [
      "a=1; Other=/",
      "b=2; Other=0; Unknown=-1",
      "c=3; Other=Thu, 01 Jan 1970 00:00:00 GMT",
      "d=4; Other=elsewhere.test",
    ]);
    expect(jar.header(`${HTTP}/api/b`)).toBe("a=1; b=2; c=3; d=4");
    expect(jar.header(`${HTTP}/`)).toBe("");
  });
});

describe("group cookie jar: the default path", () => {
  test("a request at the root, or one directory deep, defaults to '/'", () => {
    const jar = cookieJar(() => 0);
    jar.store(`${HTTP}/`, ["a=1"]);
    jar.store(`${HTTP}/page`, ["b=2"]);
    expect(jar.header(`${HTTP}/anything/at/all`)).toBe("a=1; b=2");
  });

  test("a deeper request defaults to its directory, which matches itself and what lies under it", () => {
    const jar = cookieJar(() => 0);
    jar.store(`${HTTP}/a/b/c`, ["d=1"]);
    expect(jar.header(`${HTTP}/a/b`)).toBe("d=1");
    expect(jar.header(`${HTTP}/a/b/`)).toBe("d=1");
    expect(jar.header(`${HTTP}/a/b/c/d`)).toBe("d=1");
    expect(jar.header(`${HTTP}/a/bc`)).toBe("");
    expect(jar.header(`${HTTP}/a`)).toBe("");
    expect(jar.header(`${HTTP}/x/a/b/c`)).toBe("");
  });

  test("a Path ending in '/' matches everything under it and not the path without the slash", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTP, ["a=1; Path=/api/"]);
    expect(jar.header(`${HTTP}/api/x`)).toBe("a=1");
    expect(jar.header(`${HTTP}/api/`)).toBe("a=1");
    expect(jar.header(`${HTTP}/api`)).toBe("");
  });
});

describe("group cookie jar: Domain", () => {
  test("the request's host, in any case and with a leading dot, keeps the cookie", () => {
    const jar = cookieJar(() => 0);
    jar.store(`${HTTP}/`, ["a=1; Domain=group.test", "b=2; Domain=.GROUP.test", "c=3; Domain="]);
    expect(jar.header(HTTP)).toBe("a=1; b=2; c=3");
  });

  test("a parent domain keeps it; another host, a longer host or a bare suffix drops it", () => {
    const jar = cookieJar(() => 0);
    jar.store("http://app.group.test/", [
      "parent=1; Domain=group.test",
      "other=1; Domain=else.test",
      "child=1; Domain=deep.app.group.test",
      "suffix=1; Domain=oup.test",
      "dotted=1; Domain=a.b",
    ]);
    expect(jar.header("http://app.group.test/")).toBe("parent=1");
  });

  test("only one leading dot is taken off", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTP, ["a=1; Domain=..group.test", "b=1; Domain=group.test."]);
    expect(jar.header(HTTP)).toBe("");
  });
});

describe("group cookie jar: lifetime", () => {
  test("Max-Age is seconds on the jar's clock, and the cookie is gone at that instant", () => {
    let now = 5_000;
    const jar = cookieJar(() => now);
    jar.store(HTTP, ["a=1; Path=/; Max-Age=2"]);
    now = 6_999;
    expect(jar.header(HTTP)).toBe("a=1");
    now = 7_000;
    expect(jar.header(HTTP)).toBe("");
  });

  test("a negative Max-Age deletes; a Max-Age that is not a whole number is ignored", () => {
    const jar = cookieJar(() => 1_000);
    jar.store(HTTP, ["a=1; Path=/", "b=1; Path=/", "c=1; Path=/", "d=1; Path=/", "e=1; Path=/"]);
    jar.store(HTTP, [
      "a=2; Path=/; Max-Age=-1",
      "b=2; Path=/; Max-Age=0x",
      "c=2; Path=/; Max-Age=x0",
      "d=2; Path=/; Max-Age=",
      "e=2; Path=/; Max-Age=1.5",
    ]);
    expect(jar.header(HTTP)).toBe("b=2; c=2; d=2; e=2");
  });

  test("Max-Age wins over Expires, in either order", () => {
    const jar = cookieJar(() => 1_000);
    jar.store(HTTP, [
      "a=1; Path=/; Max-Age=10; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "b=1; Path=/; Expires=Thu, 01 Jan 2099 00:00:00 GMT; Max-Age=0",
    ]);
    expect(jar.header(HTTP)).toBe("a=1");
  });

  test("Expires is read on the jar's clock: after now keeps, at or before now deletes, unreadable is ignored", () => {
    let now = Date.parse("Fri, 01 Jan 2027 00:00:00 GMT");
    const jar = cookieJar(() => now);
    jar.store(HTTP, [
      "later=1; Path=/; Expires=Fri, 01 Jan 2027 00:00:01 GMT",
      "same=1; Path=/; Expires=Fri, 01 Jan 2027 00:00:00 GMT",
      "junk=1; Path=/; Expires=not a date",
      "none=1; Path=/; Expires",
    ]);
    expect(jar.header(HTTP)).toBe("later=1; junk=1; none=1");
    now += 1_000;
    expect(jar.header(HTTP)).toBe("junk=1; none=1");
  });

  test("a cookie that has run out is neither sent nor kept when its name is set again", () => {
    let now = 0;
    const jar = cookieJar(() => now);
    jar.store(HTTP, ["a=1; Path=/; Max-Age=1", "z=1; Path=/"]);
    now = 2_000;
    jar.store(HTTP, ["a=2; Path=/"]);
    expect(jar.header(HTTP)).toBe("a=2; z=1");
  });
});

describe("group cookie jar: the Cookie header", () => {
  test("the longest path goes first, then the order the names were first set", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTP, ["root1=1; Path=/", "deep=1; Path=/api/lists", "mid=1; Path=/api", "root2=1; Path=/"]);
    expect(jar.header(`${HTTP}/api/lists/x`)).toBe("deep=1; mid=1; root1=1; root2=1");
  });

  test("a replaced cookie keeps its place; the same name on another path is another cookie", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTP, ["a=1; Path=/", "b=1; Path=/", "c=1; Path=/"]);
    jar.store(HTTP, ["a=2; Path=/", "a=3; Path=/api"]);
    expect(jar.header(`${HTTP}/api`)).toBe("a=3; a=2; b=1; c=1");
    expect(jar.header(`${HTTP}/`)).toBe("a=2; b=1; c=1");
  });

  test("a Secure cookie set over https is left out of an http request and the rest still go", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTPS, ["s=1; Path=/; Secure", "p=1; Path=/"]);
    expect(jar.header(HTTP)).toBe("p=1");
    expect(jar.header(HTTPS)).toBe("s=1; p=1");
  });

  test("the __Secure- and __Host- rules read the name's prefix only", () => {
    const jar = cookieJar(() => 0);
    jar.store(HTTPS, ["x__Secure-a=1; Path=/", "x__Host-b=1; Path=/api", "__host-c=1; Path=/api"]);
    expect(jar.header(`${HTTPS}/api`)).toBe("x__Host-b=1; __host-c=1; x__Secure-a=1");
  });

  test("property: cookies of one path come back in the order their names were first set", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 8 }), (names) => {
        const jar = cookieJar(() => 0);
        jar.store(
          HTTP,
          names.map((n) => `${n}=1; Path=/`),
        );
        jar.store(
          HTTP,
          [...names].reverse().map((n) => `${n}=2; Path=/`),
        );
        expect(jar.header(HTTP)).toBe(names.map((n) => `${n}=2`).join("; "));
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
