// @vitest-environment happy-dom
// k.router (Links) "`Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops."
// rfc:0157 conformance: in a client router, a `Form` submit to an action returning a non-`Href` navigates nowhere, starts no document navigation, pushes no history entry, and its `error` slot gets `keel.unexpected`.
// Seed 1337 (no generated inputs). "Nothing saved" is untestable on the client: no store of the action is observable from the harness.
import { afterEach, describe, expect, it } from "vitest";
import { BAD, acted, homeHref, open } from "./ok-not-href-client-support.ts";

const opened: { dispose(): void }[] = [];
afterEach(() => {
  for (const h of opened.splice(0)) h.dispose();
});

describe("rfc:0157 conformance: a client Form submit whose action's `ok` is no Href", () => {
  it("shows `keel.unexpected` in the Form's error slot, stays on the page, starts no document navigation and adds no history entry", async () => {
    for (const to of BAD) {
      const h = await open(to);
      opened.push(h);
      const before = h.location().entries;
      await h.fire("cl.go", { type: "click" });
      expect(acted(), JSON.stringify(to)).toBe(1);
      expect(h.find("cl.err").text, JSON.stringify(to)).toBe("keel.unexpected");
      expect(h.route().id, JSON.stringify(to)).toBe("cl.form");
      expect(h.documents(), JSON.stringify(to)).toEqual([]);
      expect(h.location().entries, JSON.stringify(to)).toBe(before);
      h.dispose();
    }
  });

  it("a valid `c.href` result still navigates: the route is the linked page and there is no error slot", async () => {
    const h = await open(homeHref);
    opened.push(h);
    await h.fire("cl.go", { type: "click" });
    expect(h.route().id).toBe("cl.home");
    expect(h.documents()).toEqual([]);
  });
});
