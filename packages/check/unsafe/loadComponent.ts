import { unsafe } from "./unsafe.ts";

/** A component as the rendered check calls it: props in, DOM node out. */
type Rendered = (props: Readonly<Record<string, unknown>>) => Node;

/**
 * Run compiled CommonJS module text in-process with the given `require` and return its default export as a
 * component, or `null` when the default export is not a function.
 */
export function loadComponent(js: string, require: (id: string) => unknown): Rendered | null {
  return unsafe(
    "rendered check (k.check step 4): evaluates compiled app module text via new Function; its default export is untyped JS assumed to be a component returning a Node",
    () => {
      const module: { exports: unknown } = { exports: {} };
      const run = new Function("require", "module", "exports", js);
      run(require, module, module.exports);
      const exported: unknown = module.exports;
      const def: unknown =
        typeof exported === "object" && exported !== null ? Reflect.get(exported, "default") : undefined;
      return typeof def === "function" ? (def as Rendered) : null;
    },
  );
}
