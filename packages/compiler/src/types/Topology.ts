/**
 * A parsed `topology.ts` (k.server): deployable name -> its modules and adapter. `adapter: 'client'` declares
 * no server (loaders and actions run in the browser; the Vite plugin generates the `mount` entry).
 */
export type Topology = Readonly<
  Record<string, { readonly modules: readonly string[]; readonly adapter: "node" | "static" | "client" }>
>;
