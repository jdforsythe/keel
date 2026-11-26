// The passing cases of @keel/testing's own e2e run (test/e2eRun.test.ts): each verb on a built fixture app.
import { scope } from "@keel/reactive";
import { store } from "@keel/store";
import { serve } from "@keel/testing/e2e";
import { expect, it } from "vitest";
import { Board } from "../modules/a/Board.schema.ts";

const board = scope(() => undefined).run(() => store(Board, { lists: [] }, { id: "a.board" }));
const failure = async (p: Promise<unknown>): Promise<{ code: unknown; message: string }> => {
  const e: unknown = await p.then(() => undefined, (x: unknown) => x);
  return { code: Reflect.get(Object(e), "code"), message: String(Reflect.get(Object(e), "message")) };
};

it("fire resolves after the answer reached the page", async () => {
  const app = await serve();
  const page = await app.open("/");
  expect((await page.find("a.count")).text).toBe("0");
  await page.fire("a.add", { type: "click" });
  expect((await page.find("a.count")).text).toBe("1");
  expect((await app.state(board)).lists).toHaveLength(1);
  expect((await page.cookies()).find((c) => c.name === "keel-caller")).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(Object.keys((await page.cookies())[0] ?? {})).not.toContain("value");
});

it("find of an absent id is E1705 and sends the browser nothing", async () => {
  const app = await serve();
  const page = await app.open("/");
  const requests = page.requests().length;
  const e = await failure(page.find("a.nope"));
  expect(e.code).toBe("E1705");
  expect(page.requests().length).toBe(requests);
});

it("until of Live on Connecting is E1735 after 10.0s", async () => {
  const app = await serve();
  const page = await app.open("/status");
  const e = await failure(page.until("a.status", { text: "Live" }));
  expect(e.code).toBe("E1735");
  expect(e.message).toContain("a.status");
  expect(e.message).toContain("Connecting");
  expect(e.message).toContain("10.0s");
});

it("a held page keeps value caret and focus over resume, a replacing claim is E1720", async () => {
  const app = await serve();
  const held = await app.open("/list", { hold: true });
  await held.fire("a.name", { type: "input", value: "Mi" });
  await held.resume();
  expect((await held.find("a.name")).value).toBe("Mi");
  expect((await held.a11y("a.name")).state.focused).toBe(true);
  await held.press("x");
  expect((await held.find("a.name")).value).toBe("Mix");
  const replaced = await app.open("/replace", { hold: true });
  const e = await failure(replaced.resume());
  expect(e.code).toBe("E1720");
});

it("a boom the test reads", async () => {
  const app = await serve();
  const page = await app.open("/boom");
  await page.fire("a.boom.go", { type: "click" });
  const problems = page.problems();
  expect(problems.some((p) => p.text.includes("boom"))).toBe(true);
  expect(page.problems()).toEqual([]);
});

it("stop and start keep the data; two serves share nothing", async () => {
  const app = await serve();
  const other = await serve();
  expect(app.origin()).not.toBe(other.origin());
  const post = { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" }, body: "" };
  expect((await app.fetch("/", post)).status).toBe(303);
  const before = await app.state(board);
  expect(before.lists).toHaveLength(1);
  expect((await other.state(board)).lists).toHaveLength(0);
  await app.stop();
  await expect(app.fetch("/")).rejects.toThrow();
  await app.start();
  expect((await app.fetch("/")).status).toBe(200);
  expect(await app.state(board)).toEqual(before);
  const e = await failure(app.until(board, (b) => b.lists.length === 99, { within: 1000 }));
  expect(e.code).toBe("E1735");
  expect(e.message).toContain("a.board");
  expect(app.serverLog("api").some((r) => r.kind === "req" && r.path === "/")).toBe(true);
});

it("page outside a library's folder is E1736", async () => {
  const e = await failure(serve({ page: () => null }));
  expect(e.code).toBe("E1736");
});
