import { type Ctx, supervise } from "@keel/ctx";
import type { JsonValue } from "@keel/schema";
import type { Job } from "../Job.type.ts";
import { Thrown } from "./Thrown.schema.ts";

/**
 * One run of a job: its stored input parsed, `fn` raced against `timeoutMs` on `ctx.clock` (then `a` aborts) and supervised as `jobs.run` (k.supervise): any value it throws, a defect among them, is reported and is `jobs.thrown`. Resolves
 * undefined for `ok`, else the failure's code: the `err` code, `jobs.timeout`, `jobs.thrown`, or `keel.fields` and
 * `jobs.unknown` for an input or job id the table no longer accepts.
 */
export async function runOnce(
  ctx: Ctx,
  j: Job<unknown> | undefined,
  input: JsonValue,
  a: AbortController,
): Promise<string | undefined> {
  if (j === undefined) return "jobs.unknown";
  const parsed = j.input.parse(input);
  if (!parsed.ok) return "keel.fields";
  const t = new AbortController();
  a.signal.addEventListener("abort", () => t.abort(), { once: true });
  const raced = await supervise(
    ctx,
    "jobs.run",
    () =>
      Promise.race([
        j.fn(parsed.value, ctx, a.signal),
        ctx.clock.after(j.timeoutMs, t.signal).then(() => "timeout" as const),
      ]),
    Thrown.make({}),
  );
  t.abort();
  if (!raced.ok) return raced.error.code;
  if (raced.value === "timeout") {
    a.abort();
    return "jobs.timeout";
  }
  return undefined;
}
