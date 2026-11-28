import { attempted } from "./attempted.ts";
import { thrownClass } from "./thrownClass.ts";
import { thrownCode } from "./thrownCode.ts";
import { thrownText } from "./thrownText.ts";

/** The most `cause` steps a record follows (k.serverlog Thrown values). */
const CAUSES = 8;

/** `<class>[ <code>]` of one value of the chain. */
const named = (x: unknown): string => {
  const cls = thrownClass(x);
  const code = thrownCode(x, cls);
  return code === undefined ? cls : `${cls} ${code}`;
};

/** The `cause` of `x`, read inside `attempted`; `undefined` when it has none or the read throws. */
const causeOf = (x: unknown): { readonly value: unknown } | undefined => {
  const read = attempted(() =>
    (typeof x === "object" || typeof x === "function") && x !== null && "cause" in x ? { value: x.cause } : undefined,
  );
  return read.ok ? read.value : undefined;
};

/**
 * How a log writes a thrown value without its text (k.serverlog Thrown values), in three parts: `head`,
 * `<class>[ <code>] #<fingerprint>` and ` at ` when there is a site; `site`, `<file>:<line>` from the top of `frames` (the
 * value's app frames, `<file>:<line>:<col>`), else `""`; `tail`, ` <- <class>[ <code>]` for each `cause`, at most 8
 * steps. `head` and `tail` are the server's own text; `site` is a path the scrub reads. `fingerprint` gives the 8 hex
 * digits of the class, a line feed and the value's text. Never throws.
 */
export function thrownForm(
  thrown: unknown,
  frames: readonly string[],
  fingerprint: (input: string) => string,
): { readonly head: string; readonly site: string; readonly tail: string } {
  const cls = thrownClass(thrown);
  const top = frames[0];
  const site = top === undefined ? "" : top.replace(/^(.*:\d+):\d+$/s, "$1");
  const head = `${named(thrown)} #${fingerprint(`${cls}\n${thrownText(thrown)}`)}${site === "" ? "" : " at "}`;
  let tail = "";
  let at = causeOf(thrown);
  for (let step = 0; step < CAUSES && at !== undefined; step++) {
    tail += ` <- ${named(at.value)}`;
    at = causeOf(at.value);
  }
  return { head, site, tail };
}
