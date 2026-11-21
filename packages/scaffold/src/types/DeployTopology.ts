import type { Origins } from "@keel/compiler";

/** A native shell a `client` deployable declares (k.shell): reverse-DNS `id`, `name` the title people see. */
type Shell = { readonly id: string; readonly name: string };

/**
 * The deployables of `topology.ts` (k.topology Declaration): name -> its modules, adapter, a `client`'s `host`
 * (k.hosting), a `node` deployable's `storage` (k.deploy), a `client`'s `shells` (k.shell) and any one's `origins`
 * (k.origins), as `topology.ts` declares them. `@keel/compiler`'s `Topology` passes as is.
 */
export type DeployTopology = Readonly<
  Record<
    string,
    {
      readonly modules: readonly string[];
      readonly adapter: "node" | "static" | "client";
      readonly host?: string | undefined;
      readonly storage?: "file" | "sqlite" | "postgres" | undefined;
      readonly shells?: { readonly capacitor?: Shell | undefined; readonly tauri?: Shell | undefined } | undefined;
      readonly origins?: Origins | undefined;
    }
  >
>;
