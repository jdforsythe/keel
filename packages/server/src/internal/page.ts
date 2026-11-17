import { type Match, pageHead } from "@keel/router/internal";
import { type JsonValue, type KeelError, err, ok } from "@keel/schema";
import type { Failure } from "./Failure.ts";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";
import type { Submission } from "./Submission.ts";
import { attempted } from "./attempted.ts";
import { devMessageOf } from "./devMessageOf.ts";
import { documentResponse } from "./documentResponse.ts";
import { encodeOr } from "./encodeOr.ts";
import { fieldSummary } from "./fieldSummary.ts";
import { inRequest } from "./inRequest.ts";
import { isAt } from "./isAt.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { publicError } from "./publicError.ts";
import { renderChain } from "./renderChain.ts";
import { runLoaders } from "./runLoaders.ts";
import { scrubbedError } from "./scrubbedError.ts";
import { statusOf } from "./statusOf.ts";
import { withoutPasswords } from "./withoutPasswords.ts";

/**
 * Run every loader of the matched chain together, then respond. Runtime requests get
 * `{ id, results: { [levelId]: Result } }`. Documents render the chain: the first loader `err` (chain order)
 * renders the nearest errorElement at or above it with the layouts above intact and sets the status by its
 * code; otherwise `status`, `failure` (an action error at the route) and `submission` (the 422 re-render:
 * field summary before the route component, `form` in `#k-state` less the keys the page renders as password
 * inputs, none when an errorElement renders instead or rendering threw) apply. `#k-state` also carries the served `route`
 * (`{ id, path, href, params, search }`, encoded) and, when a loader failed, its `error` (`code`, `data.at` only).
 */
export async function page(
  r: Req,
  m: Match & { kind: "route" },
  status: number,
  failure: Failure | null,
  submission: Submission | null,
): Promise<Handled> {
  const { chain, def, id } = m.route;
  const publicize = (e: KeelError<string, unknown>) => publicError(scrubbedError(e, r.rq), r.sv.mode);
  const outcomes = await runLoaders(r, chain, { params: m.params, search: m.search, url: r.url });
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
  const rendered = attempted(() =>
    inRequest(r.rq, () =>
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
    ),
  );
  // The served route, for the resume entry to report as the ctx's first `nav` (k.runtime).
  const route = { id, path: def.path ?? "", href: m.url, params, search };
  // A failed loader's error as the resume entry reports it (k.runtime): its code and `data.at`, nothing the page's
  // errorElement may have chosen not to show.
  const at = loaderError !== null && isAt(loaderError.data) ? { at: loaderError.data.at } : {};
  const error = loaderError === null ? {} : { error: { code: loaderError.code, message: loaderError.code, data: at } };
  const base = { route, ...error };
  if (!rendered.ok) {
    // A throw outside every route boundary: the root default alert, 500.
    const fallback = renderChain({
      chain: [],
      params: {},
      search: {},
      data: [],
      props: () => ({}),
      failure: { level: -1, bare: true, error: scrubbedError(rendered.error, r.rq) },
      prepend: "",
      ctx: r.sv.ctx,
      publicize,
    });
    return {
      response: documentResponse(r, 500, fallback, base, scrubbedError(rendered.error, r.rq).message),
      route: id,
      diags,
    };
  }
  // Only the route's own component renders the password inputs that name the keys to drop; at an errorElement the
  // submission is left out whole.
  const form =
    submission === null || shown !== null || rendered.value.caught !== null
      ? {}
      : { form: { ...submission, values: withoutPasswords(submission.values, rendered.value.html) } };
  const extra = { ...base, ...form };
  const dev = devMessageOf([shown?.error, rendered.value.caught]);
  const final = rendered.value.caught === null ? code : 500;
  const own = outcomes[chain.length - 1]?.result;
  const failedHead = loaderError !== null || rendered.value.caught !== null;
  const routeProps = { params: m.params, search: m.search, data: own?.ok === true ? own.value.value : undefined };
  const head = pageHead(m.route, m.params, routeProps, failedHead);
  return { response: documentResponse(r, final, rendered.value, extra, dev, head), route: id, diags };
}
