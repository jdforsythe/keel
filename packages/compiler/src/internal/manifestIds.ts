import type { Topology } from "../types/Topology.ts";

const MANIFEST = /^modules\/([^/]+)\/routes\.ts$/;

/**
 * The module ids whose bindings a project's own `vite build` evaluates (`projectManifests`), sorted and unique, with
 * the root-relative `modules/<id>/routes.ts` among `paths` of each app module that has one: the first `client`
 * deployable's modules by name, else every app module with a binding and, with `placed`, every module the topology
 * places.
 */
export function manifestIds(
  topology: Topology | undefined,
  paths: readonly string[],
  placed: boolean,
): { readonly ids: readonly string[]; readonly present: ReadonlyMap<string, string> } {
  const present = new Map<string, string>();
  for (const p of paths) {
    const id = MANIFEST.exec(p)?.[1];
    if (id !== undefined) present.set(id, p);
  }
  const names = topology === undefined ? [] : Object.keys(topology).sort();
  const client = names.map((n) => topology?.[n]).find((d) => d?.adapter === "client");
  const every = placed ? names.flatMap((n) => topology?.[n]?.modules ?? []) : [];
  const ids = client === undefined ? [...present.keys(), ...every] : client.modules;
  return { ids: [...new Set(ids)].sort(), present };
}
