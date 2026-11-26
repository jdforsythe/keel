import type { Locator, Page as Tab } from "playwright-core";
import type { A11yNode } from "../../types/A11yNode.ts";
import type { CookieInfo } from "../../types/CookieInfo.ts";
import type { Found } from "../../types/Found.ts";
import type { Layout } from "../../types/Layout.ts";
import type { Match } from "../../types/Match.ts";
import type { Page } from "../../types/Page.ts";
import type { StyleName } from "../../types/StyleName.ts";
import type { TestEvent } from "../../types/TestEvent.ts";
import type { Wait } from "../../types/Wait.ts";
import { fail } from "../fail.ts";
import { violationError } from "../violationError.ts";
import type { PageMatch } from "./PageApi.ts";
import type { PageDeps } from "./PageDeps.ts";
import type { TabState } from "./TabState.ts";
import { boundMs } from "./boundMs.ts";
import { e2eError } from "./e2eError.ts";
import { ensureScript } from "./ensureScript.ts";
import { knownId } from "./knownId.ts";
import { lostContext } from "./lostContext.ts";
import { quiet } from "./quiet.ts";
import { seconds } from "./seconds.ts";

/** A wait that ran out (k.e2e-page Rules): `<verb> <id>: <what was seen> after <s>s`. */
const ranOut = (verb: string, id: string, seen: string, ms: number): Error =>
  e2eError("E1735", `${verb}${id === "" ? "" : ` ${id}`}: ${seen} after ${seconds(ms)}`, { verb, id }, "k.e2e-page");

const NULL_BODY = new Set([101, 103, 204, 205, 304]);

const toMatch = (m: Match): PageMatch => {
  const { text, ...rest } = m;
  if (text === undefined) return rest;
  if (typeof text === "string") return { ...rest, text };
  return { ...rest, pattern: { source: text.source, flags: text.flags } };
};

const locate = (tab: Tab, id: string): Locator => tab.locator(`[id=${JSON.stringify(id)}]`).first();

/** Whether a Playwright error is its own timeout, which the verb reports as E1735. */
const timedOut = (e: unknown): boolean => e instanceof Error && e.name === "TimeoutError";

/** `RequestInit` as Playwright's request API takes it: headers as a record, the body as text or bytes. */
async function requestOptions(init: RequestInit): Promise<{
  method: string;
  headers: Record<string, string>;
  data?: string | Buffer;
}> {
  const headers: Record<string, string> = {};
  for (const [k, v] of new Headers(init.headers)) headers[k] = v;
  const method = init.method ?? "GET";
  const body = init.body;
  if (body === undefined || body === null) return { method, headers };
  if (typeof body === "string") return { method, headers, data: body };
  if (body instanceof URLSearchParams) {
    headers["content-type"] ??= "application/x-www-form-urlencoded;charset=UTF-8";
    return { method, headers, data: body.toString() };
  }
  const bytes = Buffer.from(await new Response(body).arrayBuffer());
  return { method, headers, data: bytes };
}

/**
 * A page handle over `state`'s tab (k.e2e-page Verbs): ids alone, each checked against the project first (E1705), each
 * wait bounded and E1735 when it runs out, each verb that acts resolving once the tab is quiet.
 */
export function makePage(state: TabState, deps: PageDeps, openTab: (path: string) => Promise<Page>): Page {
  const { tab } = state;
  const { project, origin } = deps;

  /** Runs `act` as one verb: its mark, and the failing mark when it rejects. */
  const verb = async <T>(act: () => Promise<T>): Promise<T> => {
    deps.verb();
    try {
      return await act();
    } catch (e) {
      deps.failed();
      throw e;
    }
  };

  const settled = async (name: string, id: string, ms: number, from = performance.now()): Promise<void> => {
    if (!(await quiet(state, from + ms))) {
      const open = [...state.inflight].filter((r) => !state.parked.some((p) => p.request() === r)).length;
      const why = open > 0 ? `${open} request${open === 1 ? "" : "s"} unanswered` : "the page was still changing";
      throw ranOut(name, id, why, ms);
    }
  };

  /** Resolves once `match` holds of `id`, re-read on each DOM change; E1735 naming what it shows when `ms` passes. */
  const waitFor = async (name: string, id: string, match: Match, ms: number): Promise<void> => {
    const deadline = performance.now() + ms;
    const m = toMatch(match);
    for (;;) {
      const left = deadline - performance.now();
      if (left <= 0) break;
      try {
        await ensureScript(tab);
        const ok = await tab.evaluate(([i, pm, t]) => globalThis.__keelE2e?.until(i, pm, t) ?? false, [
          id,
          m,
          left,
        ] as const);
        if (ok) {
          // One frame more, so what the page reported while it changed (a policy violation) has reached the test.
          await tab.evaluate(() => globalThis.__keelE2e?.calm(1000) ?? true);
          return;
        }
      } catch (e) {
        if (lostContext(e)) continue;
        throw e;
      }
    }
    const seen = await tab
      .evaluate(([i, pm]) => globalThis.__keelE2e?.seen(i, pm) ?? "not shown", [id, m] as const)
      .catch(() => "not shown");
    throw ranOut(name, id, seen, ms);
  };

  const shownNow = async <T>(name: string, id: string, read: () => Promise<T | null>, ms: number): Promise<T> => {
    const first = await read();
    if (first !== null) return first;
    await waitFor(name, id, {}, ms);
    const again = await read();
    if (again === null) throw ranOut(name, id, "not shown", ms);
    return again;
  };

  const found = (id: string): Promise<Found | null> =>
    ensureScript(tab).then(() => tab.evaluate((i) => globalThis.__keelE2e?.found(i) ?? null, id));

  const load = async (name: string, go: () => Promise<unknown>): Promise<void> => {
    const ms = boundMs();
    const from = performance.now();
    try {
      await go();
    } catch (e) {
      if (timedOut(e)) throw ranOut(name, "", "the document did not load", ms);
      throw e;
    }
    await settled(name, "", ms, from);
  };

  const act = async (name: string, id: string, run: (loc: Locator, ms: number) => Promise<unknown>): Promise<void> => {
    const ms = boundMs();
    const from = performance.now();
    try {
      await run(locate(tab, id), ms);
    } catch (e) {
      if (timedOut(e)) throw ranOut(name, id, "not shown or not enabled", ms);
      throw e;
    }
    await settled(name, id, ms, from);
  };

  const fireOne = (id: string, event: TestEvent): Promise<void> =>
    act("fire", id, async (loc, ms) => {
      switch (event.type) {
        case "click":
          return loc.click({ timeout: ms });
        case "input":
          await loc.focus({ timeout: ms });
          await loc.selectText({ timeout: ms });
          if (event.value === "") return tab.keyboard.press("Backspace");
          return tab.keyboard.type(event.value);
        case "change":
          if (event.value === undefined) return loc.dispatchEvent("change", undefined, { timeout: ms });
          return loc.selectOption(event.value, { timeout: ms });
        case "keydown": {
          const mods = [
            event.mod === true ? "Control+" : "",
            event.alt === true ? "Alt+" : "",
            event.shift === true ? "Shift+" : "",
          ];
          await loc.focus({ timeout: ms });
          return tab.keyboard.press(`${mods.join("")}${event.key}`);
        }
        case "submit":
          return loc.evaluate((el) => {
            const form = el instanceof HTMLFormElement ? el : el.closest("form");
            form?.requestSubmit();
          });
        case "focus":
          return loc.focus({ timeout: ms });
        case "blur":
          return loc.blur({ timeout: ms });
        case "emit":
          throw e2eError(
            "E1736",
            `fire ${id}: emit is a harness event; drive the host element's own control`,
            { id },
            "k.e2e-page",
          );
      }
    });

  const page: Page = {
    fire: (id, event) => verb(() => fireOne(knownId(project, id), event)),
    press: (key) =>
      verb(async () => {
        const ms = boundMs();
        const from = performance.now();
        await tab.keyboard.press(key);
        await settled("press", key, ms, from);
      }),
    find: (id) => verb(() => shownNow("find", knownId(project, id), () => found(id), boundMs())),
    findAll: async (prefix) => {
      await ensureScript(tab);
      return tab.evaluate((p) => globalThis.__keelE2e?.findAll(p) ?? [], prefix);
    },
    until: (id, match, wait?: Wait) => verb(() => waitFor("until", knownId(project, id), match, boundMs(wait))),
    settle: () => verb(() => settled("settle", "", boundMs())),
    a11y: (id) =>
      verb(async (): Promise<A11yNode> => {
        const at = id === undefined ? null : knownId(project, id);
        const node = await shownNow(
          "a11y",
          at ?? "",
          () => ensureScript(tab).then(() => tab.evaluate((i) => globalThis.__keelE2e?.tree(i) ?? null, at)),
          boundMs(),
        );
        const violations = await tab.evaluate(() => globalThis.__keelE2e?.axe() ?? Promise.resolve([]));
        if (violations.length > 0) throw violationError("E1703", violations);
        return node;
      }),
    focusOrder: async () => {
      await ensureScript(tab);
      return tab.evaluate(() => globalThis.__keelE2e?.focusOrder() ?? []);
    },
    navigate: (path) =>
      verb(() =>
        load("navigate", () => tab.goto(new URL(path, origin).href, { waitUntil: "load", timeout: boundMs() })),
      ),
    reload: () => verb(() => load("reload", () => tab.reload({ waitUntil: "load", timeout: boundMs() }))),
    back: () =>
      verb(() =>
        load("back", async () => {
          if ((await tab.goBack({ waitUntil: "load", timeout: boundMs() })) === null)
            throw e2eError("E1736", "back: the tab has no earlier entry", {}, "k.e2e-page");
        }),
      ),
    location: () => tab.evaluate(() => ({ path: `${location.pathname}${location.search}`, entries: history.length })),
    documents: async () => [...state.documents],
    requests: () => [...state.requests],
    cookies: async () =>
      (await tab.context().cookies()).map(
        (c): CookieInfo => ({
          name: c.name,
          domain: c.domain,
          path: c.path,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite,
          expires: c.expires,
        }),
      ),
    fetch: async (path, init = {}) => {
      const opts = await requestOptions(init);
      const r = await tab.context().request.fetch(new URL(path, origin).href, {
        ...opts,
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      const headers = new Headers();
      for (const h of r.headersArray()) headers.append(h.name, h.value);
      const body = NULL_BODY.has(r.status()) ? null : new Uint8Array(await r.body());
      return new Response(body, { status: r.status(), statusText: r.statusText(), headers });
    },
    offline: (on) => tab.context().setOffline(on),
    scroll: (y) =>
      verb(async () => {
        const ms = boundMs();
        const from = performance.now();
        const now = await tab.evaluate(() => scrollY);
        const size = tab.viewportSize();
        await tab.mouse.move((size?.width ?? 200) / 2, (size?.height ?? 200) / 2);
        await tab.mouse.wheel(0, y - now);
        const still = await tab.evaluate(
          (t) =>
            new Promise<boolean>((done) => {
              const end = performance.now() + t;
              let last = scrollY;
              let calm = 0;
              const frame = (): void => {
                if (scrollY === last) calm++;
                else calm = 0;
                last = scrollY;
                if (calm >= 3 || performance.now() > end) {
                  done(calm >= 3);
                  return;
                }
                requestAnimationFrame(frame);
              };
              requestAnimationFrame(frame);
            }),
          ms,
        );
        if (!still) throw ranOut("scroll", "", "the document was still scrolling", ms);
        await settled("scroll", "", ms, from);
      }),
    viewport: (size) =>
      verb(async () => {
        const ms = boundMs();
        const from = performance.now();
        await tab.setViewportSize(size);
        await settled("viewport", "", ms, from);
      }),
    layout: (id) =>
      verb(
        (): Promise<Layout> =>
          shownNow(
            "layout",
            id === undefined ? "" : knownId(project, id),
            () =>
              ensureScript(tab).then(() => tab.evaluate((i) => globalThis.__keelE2e?.layout(i) ?? null, id ?? null)),
            boundMs(),
          ),
      ),
    style: (id, names) =>
      verb(async () => {
        const values = await shownNow(
          "style",
          knownId(project, id),
          () =>
            ensureScript(tab).then(() =>
              tab.evaluate(([i, n]) => globalThis.__keelE2e?.style(i, n) ?? null, [id, [...names]] as const),
            ),
          boundMs(),
        );
        const out: Partial<Record<StyleName, string>> = {};
        for (const n of names) {
          const v = values[n];
          if (v !== undefined) out[n] = v;
        }
        return out;
      }),
    resume: () =>
      verb(async () => {
        if (!state.holding) throw e2eError("E1736", "resume: the page was not opened with hold", {}, "k.e2e-page");
        const ms = boundMs();
        const from = performance.now();
        await ensureScript(tab);
        await tab.evaluate(() => globalThis.__keelE2e?.hold());
        state.holding = false;
        for (const r of state.parked.splice(0)) await r.continue().catch(() => undefined);
        await tab.unrouteAll({ behavior: "ignoreErrors" });
        await settled("resume", "", ms, from);
        const check = await tab.evaluate(() => globalThis.__keelE2e?.held() ?? { ok: true as const });
        if (!check.ok) throw fail("E1720", `the document did not resume in place: ${check.why}`, { why: check.why });
      }),
    problems: () => state.problems.splice(0),
    open: (path) => openTab(path),
  };
  return page;
}
