/**
 * Whether `v` is a function. A binding's `component`, `errorElement` and `title` are typed by `manifest`'s
 * signature (`Binding`), which states what each takes and returns; at run time only that it is callable is known.
 */
export function isFunction<F extends (...args: never[]) => unknown>(v: unknown): v is F {
  return typeof v === "function";
}
