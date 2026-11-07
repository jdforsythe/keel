/**
 * Non-enumerable own key on every `Result` that `ok`/`err` make (rfc:0068). `Symbol.for` so `@keel/reactive` can
 * recognize a keel `Result` without depending on this package; JSON, spread, `toEqual` and `structuredClone` skip it.
 */
export const resultBrand: unique symbol = Symbol.for("keel.result");
