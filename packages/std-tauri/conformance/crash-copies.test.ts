// Spec: std.shells, Conformance "With `tauriDrivers`, a save cut at any byte of `keel.json` or `keel.b.json` leaves a new driver reading the earlier or the new value of every key; a copy of a lower generation or a wrong checksum is not read; with no whole copy and `keel.json` present every call rejects and both files keep their bytes."
// Seed: 1337 (the cases here are exhaustive over the offsets of a fixed save; the generated ones are in crash-copies.property.test.ts).
// @vitest-environment happy-dom
// Assumption: the store plugin stand-in of fixtures.ts keeps files as bytes, a `save` empties its file and then writes it (as `fs::write` does) and `cutSave(path, bytes)` kills the process inside it after `bytes` bytes;
// the earlier state is what the last resolved write left, and the new state what the cut write would have left; a new driver is a `tauriDrivers` after `world.restart()`.
// A "copy" is the value of the file's one key, `{ gen, sum, data }` (the spec's names); a lower generation is a copy an earlier write saved, and a wrong checksum one whose `sum` or `data` was changed.
// Assumption: "every call rejects" is `get`, `set`, `read` and `commit`, each tried twice; a rejection is held to the promise rejecting, whatever the reason.
import { tauriDrivers } from "@keel/std-tauri";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  BACKUP_FILE,
  begin,
  editCopy,
  end,
  ORIGIN,
  PAGES,
  STORE_FILE,
  settled,
  wrongData,
  wrongSum,
  type World,
} from "./fixtures.ts";

const KEYS = ["a", "b", "c"] as const;
const FILES = [STORE_FILE, BACKUP_FILE] as const;
let world: World;
const storage = () => tauriDrivers({ origin: ORIGIN }).storage;

type State = Record<string, string | null>;
const stateOf = (tag: string): State => ({ a: `${tag}-a`, b: `${tag}-é-b`, c: `${tag}-c` });
const EMPTY: State = { a: null, b: null, c: null };

const readAll = async (): Promise<State> => {
  const values = await storage().read([...KEYS]);
  return { a: values[0] ?? null, b: values[1] ?? null, c: values[2] ?? null };
};
const writeState = async (st: ReturnType<typeof storage>, from: State, to: State): Promise<void> => {
  const ok = await st.commit(KEYS.map((key) => ({ key, expect: from[key] ?? null, value: to[key] ?? undefined })));
  expect(ok).toBe(true);
};
/** Writes `states` in order from an empty store, each resolved, and returns the last. */
const history = async (states: readonly State[]): Promise<State> => {
  const st = storage();
  let held = EMPTY;
  for (const next of states) {
    await writeState(st, held, next);
    held = next;
  }
  return held;
};

describe("std.shells: a save cut inside keel.json or keel.b.json", () => {
  beforeEach(() => {
    world = begin(PAGES[0]);
  });
  afterEach(end);

  for (const file of FILES) {
    for (const before of [[], [stateOf("one")], [stateOf("one"), stateOf("two")]] as const) {
      test(`a save cut at any byte of \`${file}\` leaves a new driver reading the earlier or the new value of every key (${before.length} earlier writes)`, async () => {
        const next = stateOf("new");
        let visited = 0;
        for (let bytes = 0; ; bytes++) {
          world.wipe();
          const earlier = await history(before);
          world.cutSave(file, bytes);
          await settled(writeState(storage(), earlier, next));
          const hit = world.cutShort();
          if (bytes === 0) expect(hit).toBe(true);
          world.restart();
          const after = await readAll();
          const asEarlier = KEYS.every((k) => after[k] === earlier[k]);
          const asNew = KEYS.every((k) => after[k] === next[k]);
          expect(asEarlier || asNew).toBe(true);
          for (const k of KEYS) expect([earlier[k], next[k]]).toContain(after[k]);
          visited++;
          if (!hit) break;
        }
        expect(visited).toBeGreaterThan(20);
      });
    }
  }

  test("a copy of a lower generation is not read", async () => {
    const one = stateOf("one");
    const two = stateOf("two");
    await history([one]);
    const first = { [STORE_FILE]: world.read(STORE_FILE), [BACKUP_FILE]: world.read(BACKUP_FILE) };
    world.wipe();
    await history([one, two]);
    const second = { [STORE_FILE]: world.read(STORE_FILE), [BACKUP_FILE]: world.read(BACKUP_FILE) };
    for (const [lowIn, highIn] of [
      [STORE_FILE, BACKUP_FILE],
      [BACKUP_FILE, STORE_FILE],
    ] as const) {
      world.wipe();
      world.write(lowIn, first[lowIn] ?? "");
      world.write(highIn, second[highIn] ?? "");
      expect(await readAll()).toEqual(two);
    }
  });

  test("a copy with a wrong checksum is not read", async () => {
    const one = stateOf("one");
    const two = stateOf("two");
    await history([one]);
    const first = { [STORE_FILE]: world.read(STORE_FILE), [BACKUP_FILE]: world.read(BACKUP_FILE) };
    world.wipe();
    await history([one, two]);
    const second = { [STORE_FILE]: world.read(STORE_FILE), [BACKUP_FILE]: world.read(BACKUP_FILE) };
    for (const [badIn, goodIn] of [
      [STORE_FILE, BACKUP_FILE],
      [BACKUP_FILE, STORE_FILE],
    ] as const) {
      for (const spoil of [wrongSum, wrongData]) {
        world.wipe();
        world.write(badIn, editCopy(second[badIn], spoil));
        world.write(goodIn, first[goodIn] ?? "");
        expect(await readAll()).toEqual(one);
      }
    }
  });

  describe("with no whole copy", () => {
    const layouts: ReadonlyArray<{ readonly name: string; readonly put: (w: World, whole: string) => void }> = [
      {
        name: "`keel.json` cut short and no `keel.b.json`",
        put: (w, whole) => w.write(STORE_FILE, whole.slice(0, Math.floor(whole.length / 2))),
      },
      {
        name: "both files cut short",
        put: (w, whole) => {
          w.write(STORE_FILE, whole.slice(0, 7));
          w.write(BACKUP_FILE, "");
        },
      },
      {
        name: "both files with a wrong checksum",
        put: (w, whole) => {
          w.write(STORE_FILE, editCopy(whole, wrongSum));
          w.write(BACKUP_FILE, editCopy(whole, wrongData));
        },
      },
      {
        name: "`keel.json` holding plain keys and no `keel.b.json`",
        put: (w) => w.write(STORE_FILE, JSON.stringify({ a: "plain", b: "keys" })),
      },
    ];

    for (const layout of layouts) {
      test(`with no whole copy and \`keel.json\` present (${layout.name}) every call rejects and both files keep their bytes`, async () => {
        await history([stateOf("one")]);
        const whole = world.read(STORE_FILE) ?? "";
        world.wipe();
        layout.put(world, whole);
        const before = { [STORE_FILE]: world.read(STORE_FILE), [BACKUP_FILE]: world.read(BACKUP_FILE) };
        expect(before[STORE_FILE]).toBeDefined();
        for (let driver = 0; driver < 2; driver++) {
          world.restart();
          const st = storage();
          for (let again = 0; again < 2; again++) {
            expect(await settled(st.get("a"))).toBe("rejected");
            expect(await settled(st.set("a", "x"))).toBe("rejected");
            expect(await settled(st.read(["a", "b"]))).toBe("rejected");
            expect(await settled(st.commit([{ key: "a", expect: null, value: "y" }]))).toBe("rejected");
          }
        }
        expect({ [STORE_FILE]: world.read(STORE_FILE), [BACKUP_FILE]: world.read(BACKUP_FILE) }).toEqual(before);
      });
    }
  });

  describe("with `keel.json` missing", () => {
    test("with no file at all the store is empty", async () => {
      expect(await readAll()).toEqual(EMPTY);
    });

    test("with `keel.json` missing and `keel.b.json` cut short the store is empty", async () => {
      await history([stateOf("one")]);
      const whole = world.read(BACKUP_FILE) ?? "";
      world.wipe();
      world.write(BACKUP_FILE, whole.slice(0, 5));
      expect(await readAll()).toEqual(EMPTY);
    });

    test("with `keel.json` missing and a whole `keel.b.json` a new driver reads the copy", async () => {
      const one = stateOf("one");
      await history([one]);
      const whole = world.read(BACKUP_FILE) ?? "";
      world.wipe();
      world.write(BACKUP_FILE, whole);
      expect(await readAll()).toEqual(one);
    });
  });
});
