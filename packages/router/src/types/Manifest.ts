import type { RouteDef } from "./RouteDef.ts";

/** A validated route table returned by `manifest()`; route ids are the literal keys of `routes`. */
export type Manifest<M extends Readonly<Record<string, RouteDef>>> = {
  readonly kind: "keel.manifest";
  readonly routes: M;
};
