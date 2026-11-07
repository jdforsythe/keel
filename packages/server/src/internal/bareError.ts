import type { Level } from "@keel/router/internal";
import { err } from "@keel/schema";
import type { Failure } from "./Failure.ts";
import type { Handled } from "./Handled.ts";
import type { Rec } from "./Rec.ts";
import type { Req } from "./Req.ts";
import { devMessageOf } from "./devMessageOf.ts";
import { documentResponse } from "./documentResponse.ts";
import { jsonResponse } from "./jsonResponse.ts";
import { publicError } from "./publicError.ts";
import { renderChain } from "./renderChain.ts";

/**
 * Respond with a failure found before any loader ran (404, guard error): runtime requests get the `err`
 * Result as JSON; documents render the failure's errorElement (alone when `bare`) with no loader data.
 */
export function bareError(
  r: Req,
  route: string | undefined,
  status: number,
  chain: readonly Level[],
  params: Rec,
  failure: Failure,
): Handled {
  const publicize = (e: Failure["error"]) => publicError(e, r.sv.mode);
  if (r.runtime) return { response: jsonResponse(status, err(publicize(failure.error))), route, diags: [] };
  const rendered = renderChain({
    chain,
    params,
    search: {},
    data: [],
    props: () => ({}),
    failure,
    prepend: "",
    ctx: r.sv.ctx,
    publicize,
  });
  const dev = devMessageOf([failure.error, rendered.caught]);
  const code = rendered.caught === null ? status : 500;
  return { response: documentResponse(r, code, rendered, {}, dev), route, diags: [] };
}
