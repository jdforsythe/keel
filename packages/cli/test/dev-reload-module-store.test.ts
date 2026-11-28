// k.data Dev, k.store Ids: under `keel dev`, an edit that makes a module holding a module-level store run again (here
// `listOutbox.ts`, the `shopping.outbox` store) loads the server graph again
// with the earlier load's stores ended, so the store's id is free and the page renders. Seed 1337 (no generated input:
// one process scenario). One `keel dev` on a free port, its process group killed in `finally`.
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { type Tree, cloneTree, dropTree, householdTree, until } from "../conformance/derived-support.ts";
import { get, startDev } from "../conformance/evaluator-support.ts";

const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});

describe("keel dev reloads a module-level store", () => {
  test(
    "after two edits of `listOutbox.ts`, `GET /list` is answered after each and the output holds no `already in use`",
    async () => {
      const house = householdTree();
      made.push(house);
      const t = cloneTree(house);
      made.push(t);
      const dev = await startDev(t.dir, 120_000);
      try {
        const page = async (): Promise<number | undefined> => (await get(dev.port, "/list"))?.status;
        expect(await until(async () => (await page()) !== undefined, testTime(60_000)), dev.output()).toBe(true);
        for (const n of [1, 2]) {
          appendFileSync(join(t.dir, "modules/shopping/listOutbox.ts"), `\n// edit ${n}\n`);
          // The watcher's reload: the page is answered by the next load, whose module graph ran the edit.
          await new Promise((r) => setTimeout(r, 1_500));
          const status = await page();
          expect(status, dev.output()).toBeDefined();
          expect(status, dev.output()).toBeLessThan(500);
        }
        expect(dev.output()).not.toContain("already in use");
      } finally {
        dev.stop();
      }
    },
    testTime(600_000),
  );
});
