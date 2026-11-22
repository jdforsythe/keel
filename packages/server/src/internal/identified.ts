import type { IdentifyAnswer } from "./IdentifyAnswer.ts";
import type { Served } from "./Served.ts";
import { diagLine } from "./diagLine.ts";

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
 * One call of the identity source's `identify` (k.user) on `raw` without its body, with `caller`, bounded by 5,000 ms
 * on `ctx.clock`: a string of at most 256 characters is the user; a throw writes a `keel.unexpected` diag naming the
 * error's `name` only, an invalid answer one with `identify returned: invalid`; no answer in time is `busy`. With no
 * identity source it answers `""` and calls nothing.
 */
export async function identified(sv: Served, raw: Request, caller: string): Promise<IdentifyAnswer> {
  const id = sv.identity;
  if (id === undefined) return { kind: "user", user: "" };
  const stop = new AbortController();
  const request = new Request(raw.url, { method: raw.method, headers: raw.headers });
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
  if (answer === null) return { kind: "busy", limit: LIMIT };
  const { value, bad } = answer;
  if (bad === "" && typeof value === "string") return { kind: "user", user: value };
  sv.log?.write(diagLine(sv.log.format, { code: "keel.unexpected", message: `identify ${bad}` }));
  return { kind: "bad", bad };
}
