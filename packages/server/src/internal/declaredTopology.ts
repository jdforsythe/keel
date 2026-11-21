import type { Origins, Topology } from "@keel/compiler";

/**
 * `topology` with each deployable's `origins` replaced by its entry in `origins`, the static read's declaration
 * (k.origins; a deployable without an entry declares none), so a runtime value never adds an origin the read did not
 * accept. Without `origins` (a test's `createApp`), `topology` as given.
 */
export function declaredTopology(topology: Topology, origins?: Readonly<Record<string, Origins>>): Topology {
  if (origins === undefined) return topology;
  const out: Record<string, Topology[string]> = {};
  for (const [name, d] of Object.entries(topology)) {
    const { origins: _runtime, ...rest } = d;
    const declared = Object.hasOwn(origins, name) ? origins[name] : undefined;
    out[name] = declared === undefined ? rest : { ...rest, origins: declared };
  }
  return out;
}
