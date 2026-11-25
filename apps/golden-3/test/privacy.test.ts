import { createCtx } from "@keel/ctx";
import { piiPaths, piiValues } from "@keel/schema";
import { createApp } from "@keel/server";
import { record } from "@keel/std-sessions/record";
import { session } from "@keel/std-sessions/session";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { SignupDraft } from "../modules/shifts/SignupDraft.schema.ts";
import topology from "../topology.ts";
import { webRoutes } from "./webRoutes.ts";

const origin = "http://localhost";

/** One generated value of at least 8 characters for each marked path, valid for its format. */
const generated = (path: string, n: number): string => {
  const stem = `canary${n}x${path}`;
  if (path === "email") return `${stem}@canary-mail.example`;
  if (path === "phone") return `+44 7700 ${900000 + n * 7919}`;
  return `${stem} Quillfeather`;
};

const fill = (n: number) => Object.fromEntries(piiPaths(SignupDraft).map((p) => [p.path, generated(p.path, n)]));

async function start() {
  const ctx = createCtx({ mode: "sim", seed: 7 });
  const lines: string[] = [];
  const app = await createApp({
    topology,
    routes: webRoutes,
    ctx,
    deployable: "web",
    log: { format: "json", write: (line) => void lines.push(line) },
  });
  return { ctx, app, lines };
}

test("every marked path of the sign-up draft is generated, at least 8 characters", () => {
  const draft = SignupDraft.parse(fill(1));
  expect(draft.ok).toBe(true);
  if (!draft.ok) return;
  const values = piiValues(SignupDraft, SignupDraft.encode(draft.value));
  expect(values).toHaveLength(piiPaths(SignupDraft).length);
  expect(
    piiPaths(SignupDraft)
      .map((p) => p.path)
      .sort(),
  ).toEqual(["email", "name", "needs", "phone"]);
  for (const value of values) expect(value.length).toBeGreaterThanOrEqual(8);
});

test("no marked value reaches the log, the recorder, the sessions or the archive", async () => {
  const { ctx, app, lines } = await start();
  const first = SignupDraft.parse(fill(1));
  const second = SignupDraft.parse(fill(2));
  const typed = SignupDraft.parse(fill(3));
  expect(first.ok && second.ok && typed.ok).toBe(true);
  if (!first.ok || !second.ok || !typed.ok) return;
  const values = [first.value, second.value, typed.value].flatMap((d) => piiValues(SignupDraft, SignupDraft.encode(d)));
  const rejected = "canary-rejected-not-an-email-4";
  values.push(rejected);

  const recorder = record(ctx);

  // A valid sign-up, one for a shift that does not exist, one that fails validation: each a request the log sees.
  const post = (path: string, d: Record<string, string>) =>
    app.fetch(new Request(`${origin}${path}`, { method: "POST", body: new URLSearchParams(d) }));
  expect((await post("/shifts/s1", fill(1))).status).toBe(303);
  expect((await post("/shifts/zz", fill(2))).status).toBe(404);
  expect((await post("/shifts/s1", { ...fill(2), email: rejected })).status).toBe(422);

  // A person typing the same kind of values into the page, recorded on the page's own ctx.
  const page = await renderRoute("shifts.show", { routes: webRoutes, params: { shiftId: "s2" }, app, ctx });
  const pageRecorder = record(page.ctx);
  for (const [path, value] of Object.entries(fill(3))) await page.fire(`shifts.join:${path}`, { type: "input", value });
  await page.fire("shifts.join.submit", { type: "click" });
  expect(page.route().id).toBe("shifts.mine");

  const recorded = [recorder.stop(), pageRecorder.stop()];
  const sink = session(ctx);
  for (const one of recorded) {
    expect((await sink.put(new URL("/sessions", origin), one)).ok).toBe(true);
    const filed = await app.fetch(
      new Request(`${origin}/sessions`, {
        method: "POST",
        body: JSON.stringify(one),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(filed.status).toBe(200);
  }

  const archive = await ctx.storage.get("keel.store.sessions.archive");
  const sinks: Record<string, string> = {
    log: lines.join("\n"),
    recorderEvents: JSON.stringify(recorded),
    taken: JSON.stringify(sink.taken()),
    archive: archive ?? "",
  };
  // The canary is live: the values did reach the one place that keeps them, and the recorders did see the typing.
  expect((await ctx.storage.get("keel.store.shifts.board")) ?? "").toContain(values[0] ?? "missing");
  expect(sinks.recorderEvents).toContain("shifts.join:name");
  expect(lines.length).toBeGreaterThan(3);
  expect(sink.taken()).toHaveLength(2);
  for (const [name, text] of Object.entries(sinks)) {
    for (const value of values) expect(text.includes(value), `${name} holds ${value}`).toBe(false);
  }
});
