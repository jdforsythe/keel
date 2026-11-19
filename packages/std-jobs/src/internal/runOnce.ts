import type { Ctx } from "@keel/ctx";
import type { JsonValue } from "@keel/schema";
import type { Job } from "../Job.type.ts";

/**
 * One run of a job: its stored input parsed, `fn` raced against `timeoutMs` on `ctx.clock` (then `a` aborts). Resolves
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
  try {
    const r = await Promise.race([
      j.fn(parsed.value, ctx, a.signal),
      ctx.clock.after(j.timeoutMs, t.signal).then(() => null),
    ]);
    if (r === null) {
      a.abort();
      return "jobs.timeout";
    }
    return r.ok ? undefined : r.error.code;
  } catch {
    return "jobs.thrown";
  } finally {
    t.abort();
  }
}
