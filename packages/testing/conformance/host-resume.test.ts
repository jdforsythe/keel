// @vitest-environment happy-dom
// Spec: k.host-element, Conformance "After resume, `mount` runs once with the served value and the element's node; the server node is kept and no E1253 is reported."
// Spec: k.host-element, Lifecycle "`code` runs after the element's island resumes or mounts: the import resolves, then `mount` runs in the next animation frame with the current value."
// Spec: k.host-element, Lifecycle "Resume never compares or claims the element's children (no E1253 from them)."
// Seed: 1337. The server document is the client render written into a scratch host with no frame run, so it holds the element and no children, as the server writes it.
import { mount } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import { Host } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Points, SEED, flush, frames, probe } from "./host-support.ts";
import { cleanup, host } from "./host-dom.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const island = (code: ReturnType<typeof probe>["code"], points: readonly number[]) => (): Node =>
  Host({
    id: "h.chart",
    role: "img",
    label: "Chart",
    input: Points,
    value: { points },
    code: () => Promise.resolve(code),
  });

const serverHost = (id: string, make: () => Node, props: unknown): HTMLElement => {
  const scratch = host();
  const dispose = mount(make, scratch);
  const root = scratch.firstElementChild;
  if (root === null) throw new Error("fixture: no island root");
  root.setAttribute("data-k-island", id);
  const html = root.outerHTML;
  dispose();
  const h = host();
  h.innerHTML = `${html}<script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { [id]: props } })}</script>`;
  return h;
};

describe("k.host-element: resume", () => {
  test("After resume, `mount` runs once with the served value and the element's node; the server node is kept and no E1253 is reported", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: -9, max: 9 }), { maxLength: 6 }), async (points) => {
        const f = frames();
        const { log, code } = probe();
        const server = serverHost("h.chart", island(code, points), {});
        const node = server.querySelector("[data-k-host]");
        expect(node?.childElementCount).toBe(0);
        const { warnings } = resume(server, { "h.chart": island(code, points) }, {});
        expect(warnings).toEqual([]);
        expect(log.mounts).toHaveLength(0);
        await flush();
        f.step();
        await flush();
        expect(log.mounts).toHaveLength(1);
        expect(log.mounts[0]?.node).toBe(node);
        expect(log.mounts[0]?.value).toEqual({ points });
        expect(server.querySelector("[data-k-host]")).toBe(node);
        vi.unstubAllGlobals();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("`mount` runs in the animation frame after the import resolves, not before", async () => {
    const f = frames();
    const { log, code } = probe();
    const root = host();
    mount(island(code, [1]), root);
    await flush();
    expect(log.mounts).toHaveLength(0);
    expect(f.pending()).toBeGreaterThan(0);
    f.step();
    expect(log.mounts).toHaveLength(1);
  });

  test("children the outside code adds to the node are not claimed or compared at resume", async () => {
    const f = frames();
    const { code } = probe();
    const server = serverHost("h.chart", island(code, [1]), {});
    const node = server.querySelector("[data-k-host]");
    node?.appendChild(document.createElement("canvas"));
    const { warnings } = resume(server, { "h.chart": island(code, [1]) }, {});
    expect(warnings).toEqual([]);
    expect(node?.querySelector("canvas")).not.toBeNull();
    f.step();
  });
});
