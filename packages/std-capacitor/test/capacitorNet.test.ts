// net.fetch over the native plugin: failures and aborts before the headers, ids, headers and bodiless statuses.
// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import { capacitorNet } from "../src/internal/capacitorNet.ts";
import { fakeKeelHttp } from "./fakeKeelHttp.ts";

vi.mock("@capacitor/core", async (original) => {
  const actual = await original<typeof import("@capacitor/core")>();
  const { fakeKeelHttp: f } = await import("./fakeKeelHttp.ts");
  return { ...actual, registerPlugin: () => f.plugin };
});

const ORIGIN = new URL("https://golden-1.example");

async function sent(n: number): Promise<string> {
  await vi.waitFor(() => expect(fakeKeelHttp.ids.length).toBeGreaterThanOrEqual(n));
  return fakeKeelHttp.ids[n - 1] ?? "";
}

describe("capacitorNet over KeelHttp", () => {
  afterEach(() => fakeKeelHttp.reset());

  test("a failure before the headers rejects with a TypeError naming no URL and leaves no listener", async () => {
    const pending = capacitorNet(ORIGIN).fetch(new Request(`${ORIGIN.origin}/secret-path`));
    fakeKeelHttp.refuse(await sent(1));
    const error = await pending.then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(TypeError);
    expect(String(error)).not.toContain("secret-path");
    await vi.waitFor(() => expect(fakeKeelHttp.live()).toBe(0));
  });

  test("an abort before the headers cancels the native request and rejects with the signal's reason", async () => {
    const abort = new AbortController();
    const pending = capacitorNet(ORIGIN).fetch(new Request(`${ORIGIN.origin}/x`, { signal: abort.signal }));
    const id = await sent(1);
    abort.abort();
    expect(fakeKeelHttp.cancelled).toEqual([id]);
    fakeKeelHttp.refuse(id);
    await expect(pending).rejects.toBe(abort.signal.reason);
    await vi.waitFor(() => expect(fakeKeelHttp.live()).toBe(0));
  });

  test("each request has its own id, and events of another id do not reach it", async () => {
    const net = capacitorNet(ORIGIN);
    const a = net.fetch(new Request(`${ORIGIN.origin}/a`));
    const b = net.fetch(new Request(`${ORIGIN.origin}/b`));
    const ia = await sent(1);
    const ib = await sent(2);
    expect(ia).not.toBe(ib);
    fakeKeelHttp.head(ia, { status: 200, headers: {} });
    fakeKeelHttp.head(ib, { status: 200, headers: {} });
    const [ra, rb] = await Promise.all([a, b]);
    fakeKeelHttp.emit("chunk", { id: ib, data: btoa("bee") });
    fakeKeelHttp.emit("chunk", { id: ia, data: btoa("ay") });
    fakeKeelHttp.emit("end", { id: ia });
    fakeKeelHttp.emit("end", { id: ib });
    expect(await ra.text()).toBe("ay");
    expect(await rb.text()).toBe("bee");
  });

  test("headers pass through without set-cookie, and a bodiless status has a null body", async () => {
    const pending = capacitorNet(ORIGIN).fetch(new Request(`${ORIGIN.origin}/x`, { method: "DELETE" }));
    const id = await sent(1);
    fakeKeelHttp.head(id, { status: 204, headers: { "X-A": "1", "Set-Cookie": "sid=2" } });
    const res = await pending;
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
    expect(res.headers.get("x-a")).toBe("1");
    expect(res.headers.get("set-cookie")).toBeNull();
    fakeKeelHttp.emit("end", { id });
    await vi.waitFor(() => expect(fakeKeelHttp.live()).toBe(0));
  });
});
