/** A validated `topology.ts` (k.server): deployable name -> its modules and adapter. */
export type Topology = Readonly<
  Record<string, { readonly modules: readonly string[]; readonly adapter: "node" | "static" | "client" }>
>;
