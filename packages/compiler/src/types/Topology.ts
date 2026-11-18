/**
 * A parsed `topology.ts` (k.server): deployable name -> its modules and adapter. `adapter: 'client'` declares
 * no server (loaders and actions run in the browser; the Vite plugin generates the `mount` entry); a `client`
 * deployable's `host` names the `node` deployable that serves its build (k.hosting Host). The one
 * definition: `@keel/server` imports it; its `topology()` validates against an internal schema. A `node` deployable's
 * `storage` (k.deploy Storage, default `'file'`) picks its `ctx.storage`; a `client` one's `shells` (k.shell) names the
 * native shells that package it, each with a reverse-DNS `id` and the `name` people see. A `node` one's `caller: { days }`
 * (k.user Caller lifetime, an integer 1 to 400) gives the caller cookie it mints a `Max-Age` of that many days.
 */
export type Topology = Readonly<
  Record<
    string,
    {
      readonly modules: readonly string[];
      readonly adapter: "node" | "static" | "client";
      readonly host?: string;
      readonly storage?: "file" | "sqlite" | "postgres";
      readonly shells?: {
        readonly capacitor?: { readonly id: string; readonly name: string };
        readonly tauri?: { readonly id: string; readonly name: string };
      };
      readonly caller?: { readonly days: number };
    }
  >
>;
