import type { JsonSchema } from "./JsonSchema.ts";

/** What `keel build` evaluated for the surface: the contracts, the bindings of the route tables, the callers. */
export type Evaluated = {
  /** Each contract value read (app contract files, stdlib `./contract` exports, the route tables' contracts). */
  readonly contracts: readonly unknown[];
  /** Each binding of the evaluated route tables, as `bindingsOf` of `@keel/router/internal` gives it. */
  readonly bindings: readonly unknown[];
  /** The modules that import each app module's contract, sorted, by module id (`contractCallers`). */
  readonly callers: Readonly<Record<string, readonly string[]>>;
  /** The stores a `stores` factory creates (`storeShapes` from the evaluated `@keel/store/internal`), else none. */
  readonly storesOf?: (factory: unknown) => unknown;
  /**
   * The JSON Schema of a schema the evaluated modules made, else `null`, read in their own graph (k.realm); without
   * it, a schema this process made.
   */
  readonly schemaJson?: (x: unknown) => JsonSchema | null;
  /** The content hash of every app source the evaluation read, by project-relative path. */
  readonly sources: Readonly<Record<string, string>>;
};
