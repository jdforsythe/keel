// Spec: k.scaffold-shell, Conformance "With `client` deployables `web` and `admin` and a `node` deployable `api`: no `to` is one E1359 naming `web` and `admin`; `to: 'admin'` edits `admin` alone; `to: 'api'` is E1359 naming `api`; `to: 'nope'` is E1052. In `keel scaffold project q --adapter node`, no `to` is E1359. Nothing is written in each refusal."
// Spec: k.scaffold-shell, Rules "E1359 ... none, several and no `--to`, or `--to` naming another adapter; names them".
import { describe, expect, it } from "vitest";
import { errText, read, snap } from "./fixtures.ts";
import { multiTopology, pNode, shell, shellApply, squash } from "./shell-support.ts";

const ID = "com.acme.p";
const E1359 = /E1359/;

function refused(files: Map<string, string>, input: { shell: string; id: string; to?: string }, code: string): string {
  const before = snap(files);
  const r = shell(input, files);
  expect(r.ok).toBe(false);
  const t = errText(r);
  expect(t).toContain(code);
  expect(snap(files)).toBe(before);
  return t;
}

describe("scaffold shell, which deployable", () => {
  for (const kind of ["tauri", "capacitor"]) {
    it(`${kind} with no to and two client deployables is one E1359 naming web and admin`, () => {
      const t = refused(multiTopology(), { shell: kind, id: ID }, "E1359");
      expect(t.match(/E1359/g)).toHaveLength(1);
      expect(t).toContain("web");
      expect(t).toContain("admin");
    });
  }

  it("to: 'admin' edits admin alone", () => {
    const before = multiTopology();
    const out = shellApply({ shell: "tauri", id: ID, to: "admin" }, before);
    const top = squash(read(out, "topology.ts"));
    expect(top).toContain(`admin:{modules:["admin"],adapter:"client",shells:{tauri:{id:"com.acme.p",name:"P"}}}`);
    expect(top).toContain(`web:{modules:["app"],adapter:"client"}`);
    expect(top).toContain(`api:{modules:["orders"],adapter:"node"}`);
    expect(top.split("shells:").length).toBe(2);
  });

  it("to: 'web' edits web alone", () => {
    const top = squash(read(shellApply({ shell: "tauri", id: ID, to: "web" }, multiTopology()), "topology.ts"));
    expect(top).toContain(`web:{modules:["app"],adapter:"client",shells:{tauri:{id:"com.acme.p",name:"P"}}}`);
    expect(top).toContain(`admin:{modules:["admin"],adapter:"client"}`);
  });

  it("to: 'api' is E1359 naming api", () => {
    const t = refused(multiTopology(), { shell: "tauri", id: ID, to: "api" }, "E1359");
    expect(t).toContain("api");
  });

  it("to: 'nope' is E1052", () => {
    const t = refused(multiTopology(), { shell: "tauri", id: ID, to: "nope" }, "E1052");
    expect(E1359.test(t)).toBe(false);
  });

  it("in keel scaffold project q --adapter node, no to is E1359", () => {
    refused(pNode(), { shell: "tauri", id: ID }, "E1359");
  });

  it("in keel scaffold project q --adapter node, to naming its node deployable is E1359", () => {
    refused(pNode(), { shell: "capacitor", id: ID, to: "web" }, "E1359");
  });
});
