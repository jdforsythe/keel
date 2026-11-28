// std.workflows Declaration: a step's `run` answers the payload of its `done` event, so `StepSpec` types the `ok` value
// by that event's schema; a payload the event refuses is no `StepSpec`, a type error where the step is written (the run would commit
// `failed` with the schema's code). `tsc` reads the cases; the test checks the runtime values. Seed 1337.
import { createCtx } from "@keel/ctx";
import { type Infer, type KeelError, type Result, ok, s } from "@keel/schema";
import { expect, expectTypeOf, test } from "vitest";
import type { StepSpec } from "../src/index.server.ts";

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
  // `put` takes `{ putBack }`: a step answering `{ put }` for it is no StepSpec.
  type Wrong = { run: () => Promise<Result<{ put: boolean }, never>>; done: "put"; failed: "failed" };
  type Right = { run: () => Promise<Result<{ putBack: boolean }, never>>; done: "put"; failed: "failed" };
  expectTypeOf<Wrong extends StepSpec<Data, Ev> ? true : false>().toEqualTypeOf<false>();
  expectTypeOf<Right extends StepSpec<Data, Ev> ? true : false>().toEqualTypeOf<true>();
  expect([step.done, rested.done]).toEqual(["put", "rested"]);
  expect(
    await step.run({ next: 0 }, createCtx({ mode: "sim", seed: 1337 }), {
      key: "k",
      signal: new AbortController().signal,
    }),
  ).toEqual(ok({ putBack: true }));
});
