import { type JsonValue, type KeelError, attempt, err, ok } from "@keel/schema";
import type { Failure } from "./Failure.ts";
import type { Handled } from "./Handled.ts";
import type { Match } from "./Match.ts";
import type { Req } from "./Req.ts";
import type { Submission } from "./Submission.ts";
import { devMessageOf } from "./devMessageOf.ts";
import { documentResponse } from "./documentResponse.ts";
import { encodeOr } from "./encodeOr.ts";
import { fieldSummary } from "./fieldSummary.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { publicError } from "./publicError.ts";
import { renderChain } from "./renderChain.ts";
import { runLoaders } from "./runLoaders.ts";
import { statusOf } from "./statusOf.ts";

/**
 * Run every loader of the matched chain together, then respond. Runtime requests get
 * `{ id, results: { [levelId]: Result } }`. Documents render the chain: the first loader `err` (chain order)
 * renders the nearest errorElement at or above it with the layouts above intact and sets the status by its
 * code; otherwise `status`, `failure` (an action error at the route) and `submission` (the 422 re-render:
 * field summary before the route component, `form` in `#k-state`) apply.
 */
export async function page(
  r: Req,
  m: Match & { kind: "route" },
  status: number,
  failure: Failure | null,
  submission: Submission | null,
): Promise<Handled> {
  const { chain, def, id } = m.route;
  const publicize = (e: KeelError<string, unknown>) => publicError(e, r.sv.mode);
  const outcomes = await runLoaders(chain, { params: m.params, search: m.search }, r.sv.ctx);
  const diags = outcomes.flatMap((o) => (o.diag === null ? [] : [o.diag]));
  const failedAt = outcomes.findIndex((o) => !o.result.ok);
  const failed = outcomes[failedAt]?.result;
  const loaderError = failed === undefined || failed.ok ? null : failed.error;
  if (r.runtime) {
    const results = Object.fromEntries(
      outcomes.map((o, i) => [
        chain[i]?.id ?? String(i),
        o.result.ok ? ok(o.result.value.json) : err(publicize(o.result.error)),
      ]),
    );
    return {
      response: jsonResponse(loaderError === null ? 200 : statusOf(loaderError.code), { id, results }),
      route: id,
      diags,
    };
  }
  const shown: Failure | null =
    loaderError === null ? failure : { level: nearestErrorElement(chain, failedAt), bare: false, error: loaderError };
  const code = loaderError === null ? status : statusOf(loaderError.code);
  const params = encodeOr(def.params, m.params);
  const search = encodeOr(def.search, m.search);
  const props = (i: number): JsonValue => {
    const o = outcomes[i]?.result;
    return { params, search, data: o?.ok === true ? o.value.json : null };
  };
  const rendered = attempt(() =>
    renderChain({
      chain,
      params: m.params,
      search: m.search,
      data: outcomes.map((o) => (o.result.ok ? o.result.value.value : undefined)),
      props,
      failure: shown,
      prepend: submission === null || shown !== null ? "" : fieldSummary(submission),
      ctx: r.sv.ctx,
      publicize,
    }),
  );
  const extra = submission === null ? {} : { form: submission };
  if (!rendered.ok) {
    // A throw outside every route boundary: the root default alert, 500.
    const fallback = renderChain({
      chain: [],
      params: {},
      search: {},
      data: [],
      props: () => ({}),
      failure: { level: -1, bare: true, error: rendered.error },
      prepend: "",
      ctx: r.sv.ctx,
      publicize,
    });
    return { response: documentResponse(r, 500, fallback, extra, rendered.error.message), route: id, diags };
  }
  const dev = devMessageOf([shown?.error, rendered.value.caught]);
  const final = rendered.value.caught === null ? code : 500;
  return { response: documentResponse(r, final, rendered.value, extra, dev), route: id, diags };
}
