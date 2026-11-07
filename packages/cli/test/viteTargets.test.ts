// `keel build`'s Vite runs (k.server Build, RFC 0048): the project's own build unless every deployable is node, then
// one per node deployable by name.
import { describe, expect, it } from "vitest";
import { viteTargets } from "../src/internal/viteTargets.ts";

const topo = (body: string): string => `export default topology({ ${body} })\n`;

describe("viteTargets", () => {
  it("is the project's own build alone without topology.ts or without node deployables", () => {
    expect(viteTargets(undefined)).toEqual([undefined]);
    expect(viteTargets(topo('web: { modules: ["a"], adapter: "client" }'))).toEqual([undefined]);
    expect(viteTargets(topo(""))).toEqual([undefined]);
  });

  it("adds one run per node deployable, sorted by name, after the project's own build", () => {
    const src = topo(
      'z: { modules: ["z"], adapter: "node" }, web: { modules: ["a"], adapter: "client" }, b: { modules: ["b"], adapter: "node" }',
    );
    expect(viteTargets(src)).toEqual([undefined, "b", "z"]);
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
