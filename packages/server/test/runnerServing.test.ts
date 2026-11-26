// @vitest-environment node
// k.resume Stores: `tx` on a module store throws E1256 only during a request. A runner started from inside a request
// (an app made while one runs) is not that request: its writes to a module store go through.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { keepRunning } from "../src/internal/keepRunning.ts";
import { refuseModuleWrites } from "../src/internal/refuseModuleWrites.ts";
import { serving } from "../src/internal/serving.ts";

const Count = s.object({ n: s.number() });
function make() {
  const counter = store(Count, { n: 0 }, { id: "runnerServing.counter" });
  return { counter, bump: transaction(counter, "runnerServing.bump", Count, (_state, payload) => payload) };
}
const made: { fixture?: ReturnType<typeof make> } = {};
scope(
  () => {
    made.fixture = make();
  },
  { detached: true },
);
const fixtureOf = (): ReturnType<typeof make> => {
  if (made.fixture === undefined) throw new Error("fixture: store scope did not run");
  return made.fixture;
};

describe("a runner started inside a request", () => {
  it("writes a module store without E1256", async () => {
    refuseModuleWrites();
    const { counter, bump } = fixtureOf();
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const stop = new AbortController();
    const failures: string[] = [];
    const runner = {
      run: async () => {
        await Promise.resolve();
        await tx(bump, { n: 1 });
      },
    };
    const done = serving.run({ route: "t", pii: new Set(), secrets: new Set() }, () =>
      keepRunning(
        runner,
        ctx,
        stop.signal,
        (message) => void failures.push(message),
        () => [],
      ),
    );
    await new Promise<void>((settle) => setTimeout(settle, 0));
    stop.abort();
    await done;
    expect(failures).toEqual([]);
    expect(counter.get("n")).toBe(1);
  });

  it("writes a module store from an app's runner when the app is made inside a request", async () => {
    const { counter, bump } = fixtureOf();
    const lines: string[] = [];
    const app = await serving.run({ route: "t", pii: new Set(), secrets: new Set() }, () =>
      createApp({
        topology: topology({ web: { modules: ["app"], adapter: "node" } }),
        ctx: createCtx({ mode: "sim", seed: 1337 }),
        mode: "dev",
        log: { format: "json", write: (l) => lines.push(l) },
        runners: {
          app: [
            {
              run: async () => {
                await Promise.resolve();
                await tx(bump, { n: 3 });
              },
            },
          ],
        },
      }),
    );
    await new Promise<void>((settle) => setTimeout(settle, 0));
    await app.close();
    expect(lines.filter((l) => l.includes("E1256"))).toEqual([]);
    expect(counter.get("n")).toBe(3);
  });

  it("still refuses a write after an await inside the request", async () => {
    refuseModuleWrites();
    const { counter, bump } = fixtureOf();
    const thrown = await serving.run({ route: "t", pii: new Set(), secrets: new Set() }, async () => {
      await Promise.resolve();
      try {
        await tx(bump, { n: 2 });
        return "";
      } catch (error) {
        return String(error);
      }
    });
    expect(thrown).toMatch(/E1256/);
    expect(counter.get("n")).not.toBe(2);
  });
});
