// `keel build`'s Vite runs (k.server Build, k.hosting Artifact, Static): the project's own build only without a topology
// or with no deployable; then one per client deployable by name, one per static one, then one per node one.
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

  it("builds each static deployable by name, after the client ones and before the node ones", () => {
    expect(
      viteTargets(
        topo(
          't: { modules: ["t"], adapter: "static" }, n: { modules: ["n"], adapter: "node" }, s: { modules: ["s"], adapter: "static" }, w: { modules: ["w"], adapter: "client" }',
        ),
      ),
    ).toEqual(["w", "s", "t", "n"]);
    expect(viteTargets(topo('site: { modules: ["s"], adapter: "static" }'))).toEqual(["site"]);
  });

  it("skips the project's own build when every deployable is node", () => {
    expect(
      viteTargets(topo('web: { modules: ["a"], adapter: "node" }, api: { modules: ["b"], adapter: "node" }')),
    ).toEqual(["api", "web"]);
  });
});
