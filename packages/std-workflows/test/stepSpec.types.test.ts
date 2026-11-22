// std.workflows Declaration: a step's `run` answers the payload of its `done` event, so `StepSpec` types the `ok` value
// by that event's schema; a payload the event refuses is a type error where the step is written (the run would commit
// `failed` with the schema's code). `tsc` reads the cases; the test checks the runtime values. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type Infer, type KeelError, type Result, ok, s } from "@keel/schema";
import { expect, expectTypeOf, test } from "vitest";
import type { StepSpec } from "../src/index.ts";

const Events = {
  put: s.object({ putBack: s.boolean() }),
  failed: s.object({ code: s.string() }),
  rested: s.object({}),
};
type Ev = typeof Events;
type Data = { readonly next: number };

test("a step's ok value is its done event's payload", async () => {
  const step: StepSpec<Data, Ev> = { run: async () => ok({ putBack: true }), done: "put", failed: "failed" };
  type PutRun = Extract<StepSpec<Data, Ev>, { done: "put" }>["run"];
  expectTypeOf<Awaited<ReturnType<PutRun>>>().toEqualTypeOf<Result<Infer<Ev["put"]>, KeelError<string, unknown>>>();
  const rested: StepSpec<Data, Ev> = { run: async () => ok({}), done: "rested", failed: "failed" };
  // @ts-expect-error `put` takes `{ putBack }`, not `{ put }`.
  const wrong: StepSpec<Data, Ev> = { run: async () => ok({ put: true }), done: "put", failed: "failed" };
  expect([step.done, rested.done, wrong.done]).toEqual(["put", "rested", "put"]);
  expect(
    await step.run({ next: 0 }, createCtx({ mode: "sim", seed: 1337 }), {
      key: "k",
      signal: new AbortController().signal,
    }),
  ).toEqual(ok({ putBack: true }));
});
