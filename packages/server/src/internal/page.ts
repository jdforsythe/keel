import { type Match, pageHead } from "@keel/router/internal";
import { publicError } from "@keel/router/internal";
import { E1255, servedForm } from "@keel/runtime-dom/internal";
import { type JsonValue, type KeelError, err, ok } from "@keel/schema";
import type { Failure } from "./Failure.ts";
import type { Handled } from "./Handled.ts";
import type { Req } from "./Req.ts";
import type { Submission } from "./Submission.ts";
import { attempted } from "./attempted.ts";
import { caught } from "./caught.ts";
import { devMessageOf } from "./devMessageOf.ts";
import { documentResponse } from "./documentResponse.ts";
import { encodeOr } from "./encodeOr.ts";
import { fieldSummary } from "./fieldSummary.ts";
import { inRequest } from "./inRequest.ts";
import { isAt } from "./isAt.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { nearestErrorElement } from "./nearestErrorElement.ts";
import { renderChain } from "./renderChain.ts";
import { runLoaders } from "./runLoaders.ts";
import { scrubbedError } from "./scrubbedError.ts";
import { statusOf } from "./statusOf.ts";
import { withScheme } from "./withScheme.ts";
import { withServedForm } from "./withServedForm.ts";
import { withoutPasswords } from "./withoutPasswords.ts";

/**
 * Run every loader of the matched chain together, then respond. Runtime requests get
 * `{ id, results: { [levelId]: Result } }`. Documents render the chain: the first loader `err` (chain order)
 * renders the nearest errorElement at or above it with the layouts above intact and sets the status by its
 * code; otherwise `status`, `failure` (an action error at the route) and `submission` (the 422 re-render:
 * field summary before the route component, the submitted values and errors in the `<Form>` that posted them, `form` in `#k-state` less the keys the page renders as password
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
  const diags = outcomes.flatMap((o) => o.diags);
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
  // The rejected post goes to the `<Form>` that posted it (its `action` and method), so its controls render the
  // submitted values and errors (k.forms Submit); the render is synchronous, the slot cleared after it.
  const posted = submission === null || shown !== null ? null : { ...submission, href: m.url };
  const ran = await caught(
    () =>
      inRequest(r.rq, () =>
        withScheme(r, () =>
          withServedForm(posted, () =>
            renderChain({
              chain,
              params: m.params,
              search: m.search,
              data: outcomes.map((o) => (o.result.ok ? o.result.value.value : undefined)),
              props,
              failure: shown,
              prepend: (html) => (submission === null || shown !== null ? "" : fieldSummary(submission, html)),
              ctx: r.sv.ctx,
              publicize,
            }),
          ),
        ),
      ),
    r.sv.frames,
  );
  const rendered = ran.result;
  // The served route, for the resume entry to report as the ctx's first `nav` (k.runtime).
  const route = { id, path: def.path ?? "", href: m.url, params, search };
  // A failed loader's error as the resume entry reports it (k.runtime): its code and `data.at`, nothing the page's
  // errorElement may have chosen not to show.
  const at = loaderError !== null && isAt(loaderError.data) ? { at: loaderError.data.at } : {};
  const error = loaderError === null ? {} : { error: { code: loaderError.code, message: loaderError.code, data: at } };
  const base = { route, ...error };
  if (!rendered.ok) {
    // A throw outside every route boundary: the root default alert, 500. The kernel's own E1255 is logged as itself;
    // any other thrown value as its records, by its form (k.serverlog Thrown values).
    const thrown = scrubbedError(rendered.error, r.rq).message;
    const kernel = ran.thrown instanceof Error && ran.thrown.message === E1255;
    const logged = kernel
      ? [{ code: "E1255", message: E1255.slice(6) }]
      : r.sv.thrown("keel.unexpected", `render ${id} threw: `, ran.thrown, ran.frames);
    const fallback = renderChain({
      chain: [],
      params: {},
      search: {},
      data: [],
      props: () => ({}),
      failure: { level: -1, bare: true, error: scrubbedError(rendered.error, r.rq) },
      prepend: () => "",
      ctx: r.sv.ctx,
      publicize,
    });
    return {
      response: documentResponse(
        r,
        500,
        fallback,
        base,
        thrown,
        pageHead(m.route, m.params, { params: m.params, search: m.search, data: undefined }, true),
      ),
      route: id,
      diags: [...diags, ...logged],
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
  // E1257 once per route (k.claim Server): the document is served as rendered.
  if (rendered.value.eager && !r.sv.eager.has(id)) {
    r.sv.eager.add(id);
    diags.push({ code: "E1257", message: `${id}: an element was placed after it was made; make it in the thunk` });
  }
  // E1406 once per route in dev (k.place Runtime): a text binding rendered nothing.
  if (r.sv.mode === "dev" && rendered.value.nothing && !r.sv.nothing.has(id)) {
    r.sv.nothing.add(id);
    diags.push({ code: "E1406", message: `${id}: a text binding renders nothing; place the node with {props.x()}` });
  }
  // A throw a route boundary caught is logged as any thrown value is, by its form (k.serverlog Thrown values).
  const caughtThrow = rendered.value.thrown;
  // A frame reader that throws on the value (a Proxy's `stack`) gives no frames, as `caught` does.
  const framesOf = (v: unknown): readonly string[] => {
    const read = attempted(() => r.sv.frames(v));
    return read.ok ? read.value : [];
  };
  if (caughtThrow !== null) {
    const kernel = caughtThrow.value instanceof Error && caughtThrow.value.message === E1255;
    diags.push(
      ...(kernel
        ? [{ code: "E1255", message: E1255.slice(6) }]
        : r.sv.thrown("keel.unexpected", `render ${id} threw: `, caughtThrow.value, framesOf(caughtThrow.value))),
    );
  }
  return { response: documentResponse(r, final, rendered.value, extra, dev, head), route: id, diags };
}
