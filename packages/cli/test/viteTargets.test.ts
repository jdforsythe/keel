// `keel build`'s Vite runs (k.server Build, k.hosting Artifact): the project's own build only without a topology, with
// no deployable, or with a static one; then one per client deployable by name; then one per node deployable by name.
import { describe, expect, it } from "vitest";
import { viteTargets } from "../src/internal/viteTargets.ts";

const topo = (body: string): string => `export default topology({ ${body} })\n`;

describe("viteTargets", () => {
  it("is the project's own build alone without topology.ts or without deployables", () => {
    expect(viteTargets(undefined)).toEqual([undefined]);
    expect(viteTargets(topo(""))).toEqual([undefined]);
  });

  it("builds each client deployable by name, before every node deployable by name", () => {
    expect(viteTargets(topo('web: { modules: ["a"], adapter: "client" }'))).toEqual(["web"]);
    const src = topo(
      'z: { modules: ["z"], adapter: "node" }, web: { modules: ["a"], adapter: "client", servedBy: "z" }, b: { modules: ["b"], adapter: "node" }, app: { modules: ["c"], adapter: "client" }',
    );
    expect(viteTargets(src)).toEqual(["app", "web", "b", "z"]);
  });

  it("keeps the project's own build first when a deployable is static", () => {
    expect(
      viteTargets(topo('s: { modules: ["s"], adapter: "static" }, n: { modules: ["n"], adapter: "node" }')),
    ).toEqual([undefined, "n"]);
  });

  it("skips the project's own build when every deployable is node", () => {
    expect(
      viteTargets(topo('web: { modules: ["a"], adapter: "node" }, api: { modules: ["b"], adapter: "node" }')),
    ).toEqual(["api", "web"]);
  });
});
