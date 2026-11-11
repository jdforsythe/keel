/**
 * A parsed `topology.ts` (k.server): deployable name -> its modules and adapter. `adapter: 'client'` declares
 * no server (loaders and actions run in the browser; the Vite plugin generates the `mount` entry); a `client`
 * deployable's `host` names the `node` deployable that serves its build (k.hosting Host). The one
 * definition (RFC 0046): `@keel/server` imports it; its `topology()` validates against an internal schema.
 */
export type Topology = Readonly<
  Record<
    string,
    {
      readonly modules: readonly string[];
      readonly adapter: "node" | "static" | "client";
      readonly host?: string;
    }
  >
>;
