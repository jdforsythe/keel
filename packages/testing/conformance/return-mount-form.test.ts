// @vitest-environment happy-dom
// Spec: k.return, clause "Under `renderRoute(id, { shell: true })`, a valid `Form` to `mount.href('/sign-in/email')` sends one `net` POST of `/api/auth/sign-in/email` with `x-keel: 1`, `redirect: 'manual'` and the urlencoded fields, records nothing in `documents()`, and on a 303 to a page navigates there client-side."
// Seed 1337 (fc.assert below). Reuses the k.mount sign-in page (mount-pages.ts): fields `email` and `password`, submit button `mt.signin.submit`.
// Assumption: `accept: application/json` (Mount requests prose) is asserted with `x-keel`; the 303 `location` is a page of the router's table (`/about`, route `mt.about`).
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { INVALID, SEED, VALID, closeAll, openShell, plain, redirect, ticks } from "./return-support.ts";

afterEach(closeAll);

type Shell = Awaited<ReturnType<typeof openShell>>["handle"];
async function submit(h: Shell, email: string, password: string): Promise<void> {
  await h.fire("mt.signin.email", { type: "input", value: email });
  await h.fire("mt.signin.password", { type: "input", value: password });
  await h.fire("mt.signin.submit", { type: "click" });
  await ticks();
}

describe("k.return: a valid Form in a shell is a mount request through net", () => {
  it("sends one net POST of /api/auth/sign-in/email with x-keel 1, accept application/json, redirect manual and the urlencoded fields", async () => {
    const { handle, sent } = await openShell("mt.signin", () => plain());
    await submit(handle, VALID.email, VALID.password);
    expect(sent).toHaveLength(1);
    const [req] = sent;
    expect(req?.method).toBe("POST");
    expect(req?.url).toBe("/api/auth/sign-in/email");
    expect(req?.headers["x-keel"]).toBe("1");
    expect(req?.headers.accept).toBe("application/json");
    expect(req?.redirect).toBe("manual");
    expect(req?.body).toBe("email=a%40b.example&password=pw");
    handle.dispose();
  });

  it("records nothing in documents() for the valid submit", async () => {
    const { handle } = await openShell("mt.signin", () => redirect(303, "/about"));
    await submit(handle, VALID.email, VALID.password);
    expect(handle.documents()).toEqual([]);
    handle.dispose();
  });

  it("for generated typed fields, the net body is exactly the named fields as typed", async () => {
    const typed = fc.stringMatching(/^[a-z0-9@.+&=%]{3,12}$/).filter((v) => v === v.trim());
    const secret = fc.stringMatching(/^[a-z0-9&=%+]{2,12}$/);
    await fc.assert(
      fc.asyncProperty(typed, secret, async (email, password) => {
        closeAll();
        const { handle, sent } = await openShell("mt.signin");
        await submit(handle, email, password);
        expect(sent).toHaveLength(1);
        expect([...new URLSearchParams(sent[0]?.body ?? "").entries()]).toEqual([
          ["email", email],
          ["password", password],
        ]);
        expect(handle.documents()).toEqual([]);
        handle.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("on a 303 to a page the router matches, navigates there client-side and records no document", async () => {
    const { handle, sent } = await openShell("mt.signin", () => redirect(303, "/about"));
    await submit(handle, VALID.email, VALID.password);
    expect(handle.route().id).toBe("mt.about");
    expect(sent).toHaveLength(1);
    expect(handle.documents()).toEqual([]);
    handle.dispose();
  });

  it("an invalid Form sends nothing through net and records nothing", async () => {
    const { handle, sent } = await openShell("mt.signin");
    await submit(handle, INVALID.email, INVALID.password);
    expect(sent).toEqual([]);
    expect(handle.documents()).toEqual([]);
    expect(handle.find("mt.signin.errors").text).toContain("email");
    handle.dispose();
  });

  it("pending() is true until the answer arrives, then false", async () => {
    const gate: { open: () => void } = { open: () => {} };
    const held = new Promise<void>((go) => {
      gate.open = go;
    });
    const { handle, sent } = await openShell("mt.signin", async () => {
      await held;
      return plain();
    });
    await handle.fire("mt.signin.email", { type: "input", value: VALID.email });
    await handle.fire("mt.signin.password", { type: "input", value: VALID.password });
    await handle.fire("mt.signin.submit", { type: "click" });
    await ticks();
    expect(sent).toHaveLength(1);
    expect(handle.find("mt.signin.pending").text).toBe("true");
    gate.open();
    await ticks();
    expect(handle.find("mt.signin.pending").text).toBe("false");
    handle.dispose();
  });
});

describe("k.return: a POST answer without a redirect", () => {
  it("a POST answered without a redirect leaves the page as it was with pending() false", async () => {
    const { handle } = await openShell("mt.signin", () => plain());
    await submit(handle, VALID.email, VALID.password);
    expect(handle.route().id).toBe("mt.signin");
    expect(handle.find("mt.signin.pending").text).toBe("false");
    expect(handle.documents()).toEqual([]);
    handle.dispose();
  });
});
