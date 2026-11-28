// Hidden acceptance suite for evals/tasks/golden-3 (TASK.md "Acceptance" 6 and 7). pass.ts copies it to
// apps/golden-3/test/__acceptance.test.ts, runs it with the app's vitest config, and deletes it. It reaches the app only
// through what TASK.md pins: `topology`, `tokens`, the `shifts` routes, the `SignupDraft` schema, route ids and element
// ids. With `KEEL_CANARY_OUT` set it writes the canary values there, one per line, so pass.ts can search the evidence
// bundle and `.keel/sessions/` for them. With `KEEL_TWIN=throw` (a copy whose `signUp` throws with its input) only the
// "golden-3 injected" test runs.
import { createHash, createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { type Ctx, createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { piiPaths, piiValues } from "@keel/schema";
import { createApp } from "@keel/server";
import { record, session } from "@keel/std-sessions";
import { Session } from "@keel/std-sessions/Session";
import { routes as sessionsRoutes } from "@keel/std-sessions/routes";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { SignupDraft } from "../modules/shifts/SignupDraft.schema.ts";
import { routes } from "../modules/shifts/routes.ts";
import { shifts } from "../modules/shifts/shifts.contract.ts";
import { tokens } from "../tokens.ts";
import topology from "../topology.ts";

const BASE = "http://localhost";
const SECRET = "golden-3-acceptance-secret-0123456789abcdef";
const JSON_HEADERS = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };
const TWIN = process.env.KEEL_TWIN ?? "";
const PAGES = [
  "shifts.index",
  "shifts.show",
  "shifts.mine",
  "shifts.signup",
  "shifts.roster",
  "shifts.attend",
] as const;
const SIX: Readonly<Record<string, string>> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), payment=(), usb=()",
};
/** k.security Policy, as the header carries it. */
const policy = (nonce: string): string =>
  [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    "trusted-types keel",
    "report-uri /__keel/csp",
    "report-to keel-csp",
  ].join("; ");

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hashOf = (cookie: string): string => createHash("sha256").update(cookie).digest("base64url");
/** A caller cookie value the server signed under `SECRET`, as k.server mints one. */
const cookieOf = (token: string): string =>
  `${token}.${createHmac("sha256", SECRET).update(token).digest("base64url")}`;

const webRoutes = routeTable(routes, sessionsRoutes);

/** The `web` deployable over a fresh sim ctx, its log lines, and an organizer's cookie in `shifts.organizers`. */
async function setup(seed = 1) {
  const ctx = createCtx({ mode: "sim", seed });
  const lines: string[] = [];
  const app = await createApp({
    topology,
    routes: webRoutes,
    ctx,
    deployable: "web",
    secret: SECRET,
    log: { format: "json", write: (line) => lines.push(line) },
  });
  const organizer = cookieOf("organizer-token");
  await ctx.storage.set("shifts.organizers", JSON.stringify([hashOf(organizer)]));
  const call = (method: string, path: string, cookie = "", body?: unknown, accept = "application/json") =>
    app.fetch(
      new Request(new URL(path, BASE).href, {
        method,
        redirect: "manual",
        headers: {
          ...JSON_HEADERS,
          accept,
          ...(cookie === "" ? {} : { cookie: `keel-caller=${cookie}` }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  return { ctx, app, lines, organizer, call };
}

/** The sign-ups of the stored board (`keel.store.shifts.board`, a snapshot whose `state` is the `Board`). */
async function signups(ctx: Ctx): Promise<Record<string, unknown>[]> {
  const raw = await ctx.storage.get("keel.store.shifts.board");
  const snap: unknown = raw === null ? null : JSON.parse(raw);
  const state = isRecord(snap) && isRecord(snap.state) ? snap.state : {};
  return Array.isArray(state.signups) ? state.signups.filter(isRecord) : [];
}

/** The caller cookie a response set, else "". */
const cookieSet = (res: Response): string => /keel-caller=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";

/**
 * One generated value of at least 8 characters for every path `piiPaths(SignupDraft)` lists, valid for the schema.
 * A marked path this cannot fill (a nested one) fails the test: the canary must reach every declared path.
 */
function canary(seed = 3): { draft: Record<string, string>; values: string[] } {
  const r = createCtx({ mode: "sim", seed }).random;
  const draft: Record<string, string> = {};
  for (const { path } of piiPaths(SignupDraft)) {
    expect(path, `marked path ${path} is not a top-level field the canary fills`).toMatch(/^[a-z]+$/i);
    const hex = r.id("Canary").replaceAll("-", "").slice(0, 12);
    draft[path] = path === "email" ? `canary.${hex}@example.org` : `${path} ${hex}`;
  }
  const parsed = SignupDraft.parse(draft);
  expect(parsed.ok).toBe(true);
  const values = parsed.ok ? [...piiValues(SignupDraft, SignupDraft.encode(parsed.value))] : [];
  expect(values.length).toBe(Object.keys(draft).length);
  for (const v of values) expect(v.length).toBeGreaterThanOrEqual(8);
  return { draft, values };
}

const absent = (text: string, values: readonly string[], where: string): void => {
  for (const v of values) expect(text.includes(v), `${where} holds a marked value`).toBe(false);
};

const skipUnlessTwin = TWIN !== "throw";

describe.skipIf(TWIN !== "")("golden-3 acceptance", () => {
  it("each page renders with no E1703, E1804 or E1821 (axe-core, token contrast, autocomplete)", async () => {
    const env = await setup();
    const res = await env.call("POST", "/shifts/s1", "", { name: "Ada Lovelace", email: "ada@example.org" });
    expect(res.status).toBe(200);
    const volunteer = cookieSet(res);
    const caller = hashOf(volunteer);
    const id = String((await signups(env.ctx))[0]?.id ?? "");
    expect(id).not.toBe("");
    const cases: readonly [string, Record<string, string>, string][] = [
      ["shifts.index", {}, caller],
      ["shifts.show", { shiftId: "s1" }, caller],
      ["shifts.mine", {}, caller],
      ["shifts.signup", { signupId: id }, caller],
      ["shifts.roster", {}, hashOf(env.organizer)],
      ["shifts.attend", { signupId: id }, hashOf(env.organizer)],
    ];
    expect(cases.map(([page]) => page)).toEqual([...PAGES]);
    for (const [page, params, who] of cases) {
      // renderRoute runs the k.a11y render checks and rejects on E1703, E1804 or E1821.
      const r = await renderRoute(page, { routes, params, ctx: env.ctx, caller: who, artifacts: { tokens } });
      expect(String(r.route().id)).toBe(page);
      r.dispose();
    }
  });

  it("the sign-up form's focus order is name, email, phone, needs, submit, after the shell's links", async () => {
    const env = await setup();
    const r = await renderRoute("shifts.show", { routes, params: { shiftId: "s1" }, ctx: env.ctx });
    const order = r.focusOrder();
    expect(order.filter((x) => x.startsWith("shifts.join"))).toEqual([
      "shifts.join:name",
      "shifts.join:email",
      "shifts.join:phone",
      "shifts.join:needs",
      "shifts.join.submit",
    ]);
    expect(order.indexOf("shifts.mineLink")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("shifts.mineLink")).toBeLessThan(order.indexOf("shifts.join:name"));
    r.dispose();
  });

  it("after navigating from / to a shift, focus is on its h1", async () => {
    const env = await setup();
    const r = await renderRoute("shifts.index", { routes, ctx: env.ctx });
    await r.navigate(shifts.href("shifts.show", { shiftId: "s2" }));
    expect(String(r.route().id)).toBe("shifts.show");
    expect(r.find("shifts.show.title").text).toBe("Packing boxes");
    expect(r.find("shifts.show.title").state.focused).toBe(true);
    r.dispose();
  });

  it("every document carries the policy with a fresh nonce; every response the six headers", async () => {
    const env = await setup();
    const res = await env.call("POST", "/shifts/s1", "", { name: "Ada Lovelace", email: "ada@example.org" });
    const volunteer = cookieSet(res);
    const id = String((await signups(env.ctx))[0]?.id ?? "");
    const docs: readonly [string, string][] = [
      ["/", ""],
      ["/shifts/s1", ""],
      ["/mine", volunteer],
      [`/mine/${id}`, volunteer],
      ["/roster", env.organizer],
      [`/roster/${id}`, env.organizer],
    ];
    const nonces = new Set<string>();
    for (const [path, cookie] of docs) {
      const doc = await env.call("GET", path, cookie, undefined, "text/html");
      expect(doc.status, path).toBe(200);
      const csp = doc.headers.get("content-security-policy") ?? "";
      const nonce = /'nonce-([0-9a-f]+)'/.exec(csp)?.[1] ?? "";
      expect(nonce, path).toMatch(/^[0-9a-f]{64}$/);
      expect(csp, path).toBe(policy(nonce));
      expect(doc.headers.get("reporting-endpoints"), path).toBe('keel-csp="/__keel/csp"');
      const html = await doc.text();
      expect(html, path).toContain(`<meta property="csp-nonce" nonce="${nonce}">`);
      expect(html, path).toMatch(new RegExp(`<script type="module"[^>]* nonce="${nonce}"`));
      expect(html, path).not.toMatch(/<style|\sstyle="|\son[a-z]+="/);
      nonces.add(nonce);
      for (const [k, v] of Object.entries(SIX)) expect(doc.headers.get(k), `${path} ${k}`).toBe(v);
      expect(doc.headers.get("strict-transport-security"), path).toBeNull();
    }
    expect(nonces.size).toBe(docs.length);
    const others: readonly Response[] = [
      res,
      await env.call("GET", "/nowhere", "", undefined, "text/html"),
      await env.call("GET", "/roster", volunteer, undefined, "text/html"),
      await env.call("GET", "/", "", undefined, "application/json"),
      await env.call("GET", "/sessions/list", volunteer),
      await env.call("POST", `/roster/${id}`, volunteer, { attended: true }),
    ];
    for (const r of others) for (const [k, v] of Object.entries(SIX)) expect(r.headers.get(k), k).toBe(v);
    expect(others[2]?.status).toBeGreaterThanOrEqual(300);
    expect(others[2]?.status).toBeLessThan(400);
    expect(others[4]?.status).toBe(403);
    expect(others[5]?.status).not.toBe(200);
    expect((await signups(env.ctx))[0]?.attended).toBe(false);
    expect(others[3]?.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it("another caller cannot cancel a sign-up; the owner can", async () => {
    const env = await setup();
    const res = await env.call("POST", "/shifts/s3", "", { name: "Ada Lovelace", email: "ada@example.org" });
    const owner = cookieSet(res);
    const id = String((await signups(env.ctx))[0]?.id ?? "");
    const stranger = cookieOf("stranger-token");
    expect((await env.call("POST", `/mine/${id}`, stranger, {})).status).toBe(404);
    expect((await signups(env.ctx)).length).toBe(1);
    expect((await env.call("POST", `/mine/${id}`, owner, {})).status).toBe(200);
    expect((await signups(env.ctx)).length).toBe(0);
  });

  it("canary: no marked value reaches the log, the recorded or uploaded session, or the session archive", async () => {
    const env = await setup();
    const { draft, values } = canary();
    const out = process.env.KEEL_CANARY_OUT;
    if (out !== undefined) await writeFile(out, `${values.join("\n")}\n`);
    // Server: sign up with every marked field, read the pages that show them back, and the roster.
    const res = await env.call("POST", "/shifts/s1", "", draft);
    expect(res.status).toBe(200);
    const volunteer = cookieSet(res);
    const id = String((await signups(env.ctx))[0]?.id ?? "");
    for (const [path, cookie] of [
      ["/mine", volunteer],
      [`/mine/${id}`, volunteer],
      ["/roster", env.organizer],
      [`/roster/${id}`, env.organizer],
    ] as const)
      expect((await env.call("GET", path, cookie, undefined, "text/html")).status).toBe(200);
    absent(env.lines.join("\n"), [...values, hashOf(volunteer)], "the server log");
    // Client: type the values into the bound controls under a recorder, then fail a navigation so it uploads.
    const ctx = createCtx({ mode: "sim", seed: 5 });
    const rec = record(ctx, { upload: new URL("/sessions", location.origin) });
    const r = await renderRoute("shifts.show", { routes, params: { shiftId: "s2" }, ctx });
    for (const [path, value] of Object.entries(draft)) await r.fire(`shifts.join:${path}`, { type: "input", value });
    await r.navigate(shifts.href("shifts.show", { shiftId: "no-such-shift" }));
    await r.settle();
    absent(JSON.stringify(rec.events()), values, "the recorded events");
    const taken = session(ctx).taken();
    expect(taken.length).toBeGreaterThan(0);
    for (const t of taken) {
      const body = Session.encode(t.session);
      absent(JSON.stringify(body), values, "the uploaded session");
      const ingested = await env.call("POST", "/sessions", "", body);
      expect(ingested.status).toBe(200);
    }
    rec.stop();
    r.dispose();
    absent(String(await env.ctx.storage.get("keel.store.sessions.archive")), values, "the session archive");
  });
});

describe.skipIf(skipUnlessTwin)("golden-3 injected", () => {
  it("a sign-up whose action throws with its input logs one diag holding [pii] and none of the values", async () => {
    const env = await setup();
    const { draft, values } = canary();
    const res = await env.call("POST", "/shifts/s1", "", draft);
    expect(res.ok).toBe(false);
    const diags = env.lines.map((l): unknown => JSON.parse(l)).filter((x) => isRecord(x) && x.kind === "diag");
    expect(diags.length).toBeGreaterThan(0);
    expect(JSON.stringify(diags)).toContain("[pii]");
    absent(env.lines.join("\n"), values, "the server log");
  });
});
