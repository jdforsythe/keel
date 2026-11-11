/**
 * The deployables of `topology.ts` (k.topology Declaration): name -> its modules and adapter, as `topology.ts`
 * declares them. Structurally equal to `@keel/compiler`'s `Topology`, so a parsed topology passes as is.
 */
export type DeployTopology = Readonly<
  Record<string, { readonly modules: readonly string[]; readonly adapter: "node" | "static" | "client" }>
>;
