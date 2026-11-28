// @vitest-environment happy-dom
// k.router (Links) "`Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops."
// rfc:0157 conformance: a page action returning a raw non-`Href` answers a JSON POST 500 `{ ok: false, error: { code: 'keel.unexpected', message: 'unexpected', data: {} } }` and saves no store it changed.
import { describe, expect, it } from "vitest";
import { BAD, homeHref, setup } from "./ok-not-href-support.ts";

describe("rfc:0157 conformance: an action's `ok` that is no Href, JSON POST", () => {
  it("a JSON POST answers 500 `{ ok: false, error: { code: 'keel.unexpected', message: 'unexpected', data: {} } }`, no `location`, nothing saved", async () => {
    for (const to of BAD) {
      const t = await setup();
      const res = await t.json(to);
      expect(res.status, JSON.stringify(to)).toBe(500);
      expect(res.headers.get("location"), JSON.stringify(to)).toBeNull();
      expect(await res.json(), JSON.stringify(to)).toEqual({
        ok: false,
        error: { code: "keel.unexpected", message: "unexpected", data: {} },
      });
      expect(await t.saved(), JSON.stringify(to)).toBeNull();
    }
  });

  it("`ok(c.href(id))` still answers a JSON value of that `Href` and saves the store", async () => {
    const t = await setup();
    const res = await t.json(homeHref);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, value: "/" });
    expect(await t.saved()).not.toBeNull();
  });
});
