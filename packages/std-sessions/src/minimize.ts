import { type KeelError, type Result, err, ok, s } from "@keel/schema";
import type { ReplayOptions } from "./ReplayOptions.ts";
import type { Session } from "./Session.schema.ts";
import type { SessionEvent } from "./SessionEvent.ts";
import { isInput } from "./internal/isInput.ts";
import { mergeInputs } from "./internal/mergeInputs.ts";
import { replayRun } from "./internal/replayRun.ts";

const NotReproduced = s.error("sessions.notReproduced", s.object({ fingerprint: s.string() }));

/** `n` near-equal consecutive chunks of `xs` (n <= xs.length). */
function chunks(xs: readonly number[], n: number): number[][] {
  const out: number[][] = [];
  let from = 0;
  for (let i = 0; i < n; i++) {
    const to = from + Math.floor((xs.length - from) / (n - i));
    out.push(xs.slice(from, to));
    from = to;
  }
  return out;
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/**
 * Shrink `session` to a 1-minimal set of inputs that still reproduces its fingerprint (std.sessions API).
 * Inputs are `fire` and `nav` events; everything else is an observation. It replays the session (not reproduced:
 * `err` `sessions.notReproduced` with the replay's fingerprint), finds the shortest reproducing prefix of the inputs by
 * binary search on its length, then runs ddmin over it: complements of n chunks, n from 2 doubling to the input
 * count (whose complements are the single removals, in index order), until no single removal reproduces
 * (`minimal: true`) or `runs` reaches `maxRuns` (default 200; the smallest reproducing set found, `minimal: false`).
 * A candidate is the base plus the kept inputs; a candidate set is replayed at most once. The result keeps `v`, `id`,
 * `seed`, `deterministic`, `at`, `route` and `state`; its `events` are the kept inputs (at their recorded `at`) with
 * the observations of their final replay in occurrence order, and `error` and `fingerprint` come from that replay.
 * Every replay is deterministic under the seed and the candidate order is fixed, so two runs are equal. `redact` is
 * passed to each replay (see `replay`), as are `serve`, called once per run so every run starts from an empty server, `user` and `mount`.
 */
export async function minimize(
  session: Session,
  options: ReplayOptions & { readonly maxRuns?: number },
): Promise<
  Result<
    { session: Session; runs: number; minimal: boolean },
    KeelError<"sessions.notReproduced", { fingerprint: string }>
  >
> {
  const maxRuns = options.maxRuns ?? 200;
  const inputs: SessionEvent[] = session.events.filter(isInput);
  const seen = new Map<string, { readonly reproduced: boolean; readonly recorded: Session }>();
  let runs = 0;
  let spent = false;
  /** Replay the base plus `keep` (indices into `inputs`); false without a run once `maxRuns` is reached. */
  const reproduces = async (keep: readonly number[]): Promise<boolean> => {
    const key = keep.join(",");
    const known = seen.get(key);
    if (known !== undefined) return known.reproduced;
    if (runs >= maxRuns) {
      spent = true;
      return false;
    }
    runs++;
    const events = keep.flatMap((i) => inputs.slice(i, i + 1));
    const r = await replayRun(
      { ...session, events },
      {
        routes: options.routes,
        ...(options.redact === undefined ? {} : { redact: options.redact }),
        ...(options.serve === undefined ? {} : { serve: options.serve }),
        ...(options.user === undefined ? {} : { user: options.user }),
        ...(options.mount === undefined ? {} : { mount: options.mount }),
      },
    );
    seen.set(key, { reproduced: r.result.reproduced, recorded: r.recorded });
    return r.result.reproduced;
  };

  const all = range(inputs.length);
  if (!(await reproduces(all))) {
    const fingerprint = seen.get(all.join(","))?.recorded.fingerprint ?? "";
    return err(NotReproduced.make({ fingerprint }));
  }
  let lo = 0;
  let hi = inputs.length;
  while (lo < hi && !spent) {
    const mid = Math.floor((lo + hi) / 2);
    if (await reproduces(range(mid))) hi = mid;
    else lo = mid + 1;
  }
  let kept = range(hi);
  let n = 2;
  while (!spent && kept.length > 0) {
    const g = Math.min(n, kept.length);
    let reduced = false;
    for (const c of chunks(kept, g)) {
      const candidate = kept.filter((i) => !c.includes(i));
      if (await reproduces(candidate)) {
        kept = candidate;
        n = Math.max(g - 1, 2);
        reduced = true;
        break;
      }
      if (spent) break;
    }
    if (reduced) continue;
    if (g >= kept.length) break;
    n = Math.min(g * 2, kept.length);
  }
  const final = seen.get(kept.join(","))?.recorded;
  if (final === undefined) return err(NotReproduced.make({ fingerprint: "" }));
  const keptInputs = kept.flatMap((i) => inputs.slice(i, i + 1));
  const out: Session = {
    ...session,
    events: mergeInputs(keptInputs, final.events),
    error: final.error,
    fingerprint: final.fingerprint,
  };
  return ok({ session: out, runs, minimal: !spent });
}
