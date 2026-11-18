import type { KeelError } from "@keel/schema";
import type { Req } from "./Req.ts";
import { diagLine } from "./diagLine.ts";
import { unexpected } from "./unexpected.ts";

const LIMIT = 5_000;

/** The error's `name` when it is a plain identifier, else `Error`; nothing else of the thrown value is read. */
function nameOf(thrown: unknown): string {
  try {
    const name: unknown = Reflect.get(Object(thrown), "name");
    return typeof name === "string" && /^[A-Za-z]\w{0,63}$/.test(name) ? name : "Error";
  } catch {
    return "Error";
  }
}

/**
 * The `user` of a routed request (k.user), asked before its guards: the user an `x-keel-user` another deployable of
 * the app signed asserts (`keys.user`), else `identify`'s answer to the request without its body and the caller it
 * presented (`""` when this request minted one), else `""` with no identity source. Nothing is kept between
 * requests. A throw is `keel.unexpected` and a `diag` naming the error's `name` only; an answer that is not a string of
 * at most 256 characters is `keel.unexpected` and a `diag` `identify returned: invalid`; past 5,000 ms on `ctx.clock`,
 * `keel.busy` with `data: { limit: 5000 }`. The error fails the request as a guard's would (`runGuards`).
 */
export async function userOf(r: Req): Promise<string | KeelError<string, unknown>> {
  const { sv, rq, raw } = r;
  const asserted = sv.keys.user(raw, sv.ctx.clock.now());
  const id = sv.identity;
  if (asserted !== undefined || id === undefined) return asserted ?? "";
  const stop = new AbortController();
  const request = new Request(raw.url, { method: raw.method, headers: raw.headers });
  const caller = rq.caller.set === "" ? rq.caller.id : "";
  const answer = await Promise.race([
    Promise.resolve()
      .then(() => id.identify({ request, caller }, sv.ctx))
      .then(
        (value: unknown) => ({
          value,
          bad: typeof value === "string" && value.length <= 256 ? "" : "returned: invalid",
        }),
        (thrown: unknown) => ({ value: "", bad: `threw: ${nameOf(thrown)}` }),
      ),
    sv.ctx.clock.after(LIMIT, stop.signal).then(
      () => null,
      () => null,
    ),
  ]);
  stop.abort();
  if (answer === null) return { code: "keel.busy", message: `identify took over ${LIMIT} ms`, data: { limit: LIMIT } };
  const { value, bad } = answer;
  if (bad === "" && typeof value === "string") return value;
  sv.log?.write(diagLine(sv.log.format, { code: "keel.unexpected", message: `identify ${bad}` }));
  return unexpected(`identify ${bad}`);
}
