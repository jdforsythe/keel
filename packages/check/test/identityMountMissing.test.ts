// E1730 examples pinned by fix text: an empty options object, an app beside others in a monorepo, an existing import.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const at = (dir: string) => ({
  topology: {
    path: `${dir}topology.ts`,
    source:
      "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'client' } })\n",
  },
  identity: { path: `${dir}identity.ts`, source: "export default 1\n" },
});
const file = (path: string, head: string, call: string) => ({
  path,
  source: `import { renderRoute } from '@keel/testing'\n${head}declare const routes: never\nexport const t = () => ${call}\n`,
});
const found = (files: { path: string; source: string }[]) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === "E1730");

describe("E1730 a test names no identity mount", () => {
  it("fixes an empty options object as { mount }", () => {
    const { topology, identity } = at("");
    const [d] = found([topology, identity, file("modules/a/test/x.test.ts", "", "renderRoute('a.p', {})")]);
    expect(d?.fix).toContain("+import mount from '../../../identity.ts';");
    expect(d?.fix).toContain("+export const t = () => renderRoute('a.p', { mount })");
  });

  it("reads identity.ts beside the file's own topology.ts in a monorepo, not another project's", () => {
    const one = at("apps/one/");
    const two = at("apps/two/");
    const call = "renderRoute('a.p', { routes })";
    expect(found([one.topology, one.identity, file("apps/one/test/x.test.ts", "", call)])).toHaveLength(1);
    expect(found([one.topology, one.identity, two.topology, file("apps/two/test/x.test.ts", "", call)])).toEqual([]);
    const [d] = found([one.topology, one.identity, file("apps/one/test/x.test.ts", "", call)]);
    expect(d?.message).toBe("renderRoute names no identity mount; pass identity.ts's default export as mount");
  });

  it("passes an existing default import named mount without a second import", () => {
    const { topology, identity } = at("");
    const head = "import mount from '../identity.ts'\n";
    const [d] = found([topology, identity, file("test/x.test.ts", head, "renderRoute('a.p', { routes })")]);
    expect(d?.fix).not.toContain("+import");
    expect(d?.fix).toContain("{ routes, mount }");
  });

  it("does not take a type-only import of identity.ts for the mount", () => {
    const { topology, identity } = at("");
    const head = "import type who from '../identity.ts'\n";
    const [d] = found([topology, identity, file("test/x.test.ts", head, "renderRoute('a.p', { routes })")]);
    expect(d?.fix).toContain("+import mount from '../identity.ts';");
  });

  it("reports nothing outside a project, with no topology.ts", () => {
    const { identity } = at("");
    expect(found([identity, file("test/x.test.ts", "", "renderRoute('a.p', { routes })")])).toEqual([]);
  });
});
