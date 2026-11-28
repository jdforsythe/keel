// k.data Dev, k.store Ids and invariants: under `keel dev`, a store takes a carried id only at the file whose store
// held it. After `listOutbox.ts`'s outbox id is renamed, `ShoppingList.tsx` may add a store of the old id; one it
// then adds with the new id, while `listOutbox.ts` is left as it was, prints `already in use`. Seed 1337 (no generated input: one process scenario). One `keel dev` on a free port, its process
// group killed in `finally`.
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { type Tree, cloneTree, dropTree, householdTree, sub, until } from "../conformance/derived-support.ts";
import { get, startDev } from "../conformance/evaluator-support.ts";

const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});

/** A module-level store of `id` appended to a file, as an edit adds one. */
const storeOf = (id: string, n: number): string =>
  `\nimport { store as __st${n} } from "@keel/store";\nimport { s as __s${n} } from "@keel/schema";\nexport const __made${n} = __st${n}(__s${n}.object({ n: __s${n}.int() }), { n: 0 }, { id: ${JSON.stringify(id)} });\n`;

describe("keel dev narrows a carried store id to its file", () => {
  test(
    "a renamed id leaves `stores`, and another file's store of a live id prints `already in use`",
    async () => {
      const house = householdTree();
      made.push(house);
      const t = cloneTree(house);
      made.push(t);
      const dev = await startDev(t.dir, 120_000);
      try {
        const page = async (): Promise<number | undefined> => (await get(dev.port, "/list"))?.status;
        expect(await until(async () => (await page()) !== undefined, testTime(60_000)), dev.output()).toBe(true);
        const list = join(t.dir, "modules/shopping/ShoppingList.tsx");
        sub(t.dir, "modules/shopping/listOutbox.ts", '"shopping.outbox"', '"shopping.renamed"');
        await new Promise((r) => setTimeout(r, 1_500));
        expect(await page(), dev.output()).toBeLessThan(500);
        // The old id left the module registry at the load's end: another file's store may take it.
        appendFileSync(list, storeOf("shopping.outbox", 1));
        await new Promise((r) => setTimeout(r, 1_500));
        expect(await page(), dev.output()).toBeLessThan(500);
        expect(dev.output()).not.toContain("already in use");
        // `listOutbox.ts` is left as it was: its id is not that file's to take.
        appendFileSync(list, storeOf("shopping.renamed", 2));
        const refused = async (): Promise<boolean> => {
          await page();
          return dev.output().includes("store shopping.renamed: id already in use by a live store");
        };
        expect(await until(refused, testTime(30_000)), dev.output()).toBe(true);
      } finally {
        await dev.stop();
      }
    },
    testTime(600_000),
  );
});
