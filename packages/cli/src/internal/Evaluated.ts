/** What one evaluation read for the surface: the contracts, the bindings of the route tables, the callers. */
export type Evaluated = {
  /** Each contract value read (app contract files, stdlib `./contract` exports, the route tables' contracts). */
  readonly contracts: readonly unknown[];
  /** Each binding of the evaluated route tables, as `bindingsOf` of `@keel/router/internal` gives it. */
  readonly bindings: readonly unknown[];
  /** The modules that import each app module's contract, sorted, by module id (`contractCallers`). */
  readonly callers: Readonly<Record<string, readonly string[]>>;
  /** The stores a `stores` factory creates (`storeShapes` from the evaluated `@keel/store/internal`), else none. */
  readonly storesOf?: (factory: unknown) => unknown;
};
