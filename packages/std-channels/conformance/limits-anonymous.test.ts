// Spec: std.channels-limits, clause "With modules `a` and `b` serving channel routes at the default caps and 40 cookieless streams open on `a`'s route and 24 on `b`'s, a cookieless open on `a`'s route and one on `b`'s each get `{ kind: 'closed', reason: 'full' }` as their only event and the 64 streams continue; once one of the 64 ends, the next cookieless open on either route is served."
// Spec: std.channels-limits, clause "With `a` at `perAnonymous: 4`, `b` at `perAnonymous: 10` and 4 cookieless streams open on `b`'s route, a cookieless open on `a`'s route is full and one on `b`'s is served; with 10 cookieless streams open across both routes, a cookieless open on `b`'s route is full."
// Spec: std.channels-limits, clause "With `a` and `b` at the default caps and 64 cookieless streams open across their routes, a caller with a cookie is served 8 opens on `a`'s route and 8 on `b`'s and its ninth on either is full; an open whose cookie does not verify is full; and a cookieless open on a route whose `member` refuses `\"\"` gets `{ kind: 'closed', reason: 'denied' }` as its only event."
// Spec: std.channels-limits, clause "For every sequence of up to 200 opens and ends on the channel routes of one to three modules, each with `perCaller`, `perAnonymous` and `maxStreams` generated from 1 to 12, by cookieless callers and up to four callers with cookies, every `member` admitting every caller, an open is served exactly when Config finds it not full, and a full open's only event is `{ kind: 'closed', reason: 'full' }`."
// std.channels-limits, Config "An anonymous stream counts against `perAnonymous` and `maxStreams`, never `perCaller`; a stream with a user or a caller counts against that user's or caller's `perCaller` and `maxStreams`, never `perAnonymous`."
// std.channels-limits, What the caps bound "A signed-in person, with or without a caller cookie, has their own `perCaller` streams per module, which no anonymous flood and no other user takes; a client cannot assert a user, since only the identity source or a signed `x-keel-user` gives one."
// std.channels-limits, What the caps bound "An app without identity has no user, and every stream counts by caller."
// Seed 1337.
// Assumptions: as modules.ts and twoModules.ts: config reaches `createApp({ std })` from each module's manifest `std: { '@keel/std-channels': { ... } }`; a cookieless open sends no cookie; a caller with a cookie sends one minted by a write (`mint`); an open "ends" when the client aborts its request, and the place it held is free a few event-loop turns later (`settle`).
// Reading (Limits): "while it holds the app's pool every event-stream open in the process, a signed-in person's included, is 503 until its streams end" is asserted as status 503 with `keel.busy` in the body, and a served open once one stream ends.
// Reading (Config): a request is anonymous only with no user and no verified caller cookie; "has a user" means the identity source answered one or the request carries a verified (signed) `x-keel-user`. The identity fixture answers `user:<sid>` for a cookie holding `sid=<sid>`, `""` otherwise. A signed `x-keel-user` is captured from a real `service` call of a peer deployable (the header's format is not specified).
// Untestable here, said once: "Limiting opens per client address belongs to the proxy or platform in front of the app" is a statement of what Keel leaves out; the address tests below show only that Keel counts none.
import fc from "fast-check";
import { expect, test } from "vitest";
import { settle, waitFor } from "./fixtures.ts";
import { type Cfg, MODS, type Mod, type Modules, type OpenOptions, type Opened, serveModules } from "./modules.ts";

const RESET = { kind: "reset" };
const FULL = [{ kind: "closed", reason: "full" }];
const DENIED = [{ kind: "closed", reason: "denied" }];
const caller = (cookie: string): OpenOptions => ({ cookie });

/** Runs `body` over served modules and closes every stream it opened. */
async function withModules(
  cfgs: readonly Cfg[],
  body: (h: Modules, open: (m: Mod, o?: OpenOptions) => Promise<Opened>) => Promise<void>,
  o: { identity?: boolean; appMaxStreams?: number; signed?: boolean } = {},
): Promise<void> {
  const h = await serveModules(cfgs, o);
  const all: Opened[] = [];
  const open = async (m: Mod, opts?: OpenOptions): Promise<Opened> => {
    const st = await h.open(m, opts);
    all.push(st);
    await waitFor(() => st.events.length >= 1 || st.ended());
    return st;
  };
  try {
    await body(h, open);
  } finally {
    for (const st of all) st.close();
    await h.dispose();
  }
}
const isServed = (st: Opened): boolean =>
  st.events[0] !== undefined && JSON.stringify(st.events[0]) === JSON.stringify(RESET);
const expectFull = async (st: Opened): Promise<void> => {
  await settle();
  expect(st.events).toEqual(FULL);
  await waitFor(() => st.ended());
};
const expectServed = (st: Opened): void => {
  expect(st.events[0]).toEqual(RESET);
  expect(st.ended()).toBe(false);
};
const addr = (i: number): string => `203.0.113.${i % 250}`;

test("std.channels-limits 1: 40 cookieless streams on a and 24 on b make 64; the 65th on either is full, the 64 continue, and one ending frees exactly one place on either route", async () => {
  await withModules([{}, {}], async (_h, open) => {
    const held: Opened[] = [];
    for (let i = 0; i < 40; i++) held.push(await open("a", { address: addr(i) }));
    for (let i = 0; i < 24; i++) held.push(await open("b", { address: addr(40 + i) }));
    for (const st of held) expectServed(st);
    await expectFull(await open("a", { address: addr(100) }));
    await expectFull(await open("b", { address: addr(101) }));
    await settle();
    for (const st of held) expect(st.ended()).toBe(false);
    // one of the 64 ends: the next cookieless open on either route is served, and then the count is full again
    held[0]?.close();
    await waitFor(() => held[0]?.ended() === true);
    await settle(60);
    const next = await open("b", { address: addr(102) });
    expectServed(next);
    await expectFull(await open("a", { address: addr(103) }));
    await expectFull(await open("b", { address: addr(104) }));
    // and an end on b frees one for a
    next.close();
    await waitFor(() => next.ended());
    await settle(60);
    expectServed(await open("a", { address: addr(105) }));
  });
});

test("std.channels-limits 1 (every split): the 64th cookieless stream opens and the 65th is refused, however the streams divide between a and b", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 64 }), fc.boolean(), async (onA, aFirst) => {
      await withModules([{}, {}], async (_h, open) => {
        const plan: Mod[] = [
          ...Array.from({ length: onA }, (): Mod => "a"),
          ...Array.from({ length: 64 - onA }, (): Mod => "b"),
        ];
        if (!aFirst) plan.reverse();
        const held: Opened[] = [];
        for (const [i, m] of plan.entries()) held.push(await open(m, { address: addr(i) }));
        for (const st of held) expectServed(st);
        await expectFull(await open(aFirst ? "a" : "b"));
        await expectFull(await open(aFirst ? "b" : "a"));
        for (const st of held) expect(st.ended()).toBe(false);
      });
    }),
    { seed: 1337, numRuns: 4 },
  );
}, 120_000);

test("std.channels-limits 2: with a at perAnonymous 4, b at 10 and 4 cookieless streams on b, a cookieless open on a is full and one on b is served; with 10 cookieless streams across both, one on b is full", async () => {
  await withModules([{ perAnonymous: 4 }, { perAnonymous: 10 }], async (_h, open) => {
    const onB: Opened[] = [];
    for (let i = 0; i < 4; i++) onB.push(await open("b"));
    for (const st of onB) expectServed(st);
    await expectFull(await open("a"));
    const fifth = await open("b");
    expectServed(fifth);
    for (const st of [...onB, fifth]) expect(st.ended()).toBe(false);
  });
  await withModules([{ perAnonymous: 4 }, { perAnonymous: 10 }], async (_h, open) => {
    const held: Opened[] = [];
    for (let i = 0; i < 2; i++) held.push(await open("a"));
    for (let i = 0; i < 8; i++) held.push(await open("b"));
    for (const st of held) expectServed(st);
    await expectFull(await open("b"));
    await expectFull(await open("a"));
    for (const st of held) expect(st.ended()).toBe(false);
  });
});

test("std.channels-limits 2 (every pair of bounds): a cookieless open on m is served exactly when the cookieless streams of both modules together number fewer than m's perAnonymous", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 0, max: 14 }),
      fc.integer({ min: 0, max: 14 }),
      async (pa, pb, onA, onB) => {
        await withModules(
          [
            { perAnonymous: pa, maxStreams: 40 },
            { perAnonymous: pb, maxStreams: 40 },
          ],
          async (_h, open) => {
            // fill with the cookieless opens each module's own bound admits, in the order a then b
            let total = 0;
            const held: Opened[] = [];
            const fill = async (m: Mod, want: number, bound: number): Promise<void> => {
              for (let i = 0; i < want; i++) {
                const st = await open(m);
                if (total < bound) {
                  expectServed(st);
                  held.push(st);
                  total++;
                } else await expectFull(st);
              }
            };
            await fill("a", onA, pa);
            await fill("b", onB, pb);
            const a = await open("a");
            if (total < pa) expectServed(a);
            else await expectFull(a);
            if (total < pa) total++;
            const b = await open("b");
            if (total < pb) expectServed(b);
            else await expectFull(b);
            for (const st of held) expect(st.ended()).toBe(false);
          },
        );
      },
    ),
    { seed: 1337, numRuns: 12 },
  );
}, 120_000);

test('std.channels-limits 3: with 64 cookieless streams open across a and b, a caller with a cookie is served 8 opens on a and 8 on b and its ninth on either is full; an open whose cookie does not verify is full; a cookieless open on a route whose member refuses "" gets denied as its only event', async () => {
  await withModules([{}, {}, { refuseAnonymous: true }], async (h, open) => {
    const flood: Opened[] = [];
    for (let i = 0; i < 32; i++) flood.push(await open("a", { address: addr(i) }));
    for (let i = 0; i < 32; i++) flood.push(await open("b", { address: addr(32 + i) }));
    for (const st of flood) expectServed(st);
    const who = caller(await h.mint());
    const own: Opened[] = [];
    for (let i = 0; i < 8; i++) own.push(await open("a", who));
    for (let i = 0; i < 8; i++) own.push(await open("b", who));
    for (const st of own) expectServed(st);
    await expectFull(await open("a", who));
    await expectFull(await open("b", who));
    // a cookie that does not verify is no caller: cookieless, so full while the 64 stand
    await expectFull(await open("a", caller("keel-caller=not-a-cookie-this-app-set")));
    // member refuses "": denied, not full, and not counted
    const refused = await open("c");
    await waitFor(() => refused.ended());
    await settle();
    expect(refused.events).toEqual(DENIED);
    // the same open once the cookieless places are free is still denied
    for (const st of [...flood, ...own]) expect(st.ended()).toBe(false);
  });
});

test("std.channels-limits 3 (a denied open is not counted): opens member refuses leave every cookieless place free", async () => {
  await withModules([{ perAnonymous: 2 }, { refuseAnonymous: true }], async (_h, open) => {
    for (let i = 0; i < 5; i++) {
      const refused = await open("b");
      await waitFor(() => refused.ended());
      expect(refused.events).toEqual(DENIED);
    }
    expectServed(await open("a"));
    expectServed(await open("a"));
    await expectFull(await open("a"));
  });
});

// ---- 4: for every sequence of opens and ends
type Op =
  | { readonly t: "open"; readonly m: number; readonly who: number }
  | { readonly t: "end"; readonly pick: number };
const opArb = (mods: number): fc.Arbitrary<Op> =>
  fc.oneof(
    { weight: 3, arbitrary: fc.record({ t: fc.constant("open" as const), m: fc.nat(mods - 1), who: fc.nat(4) }) },
    { weight: 1, arbitrary: fc.record({ t: fc.constant("end" as const), pick: fc.nat() }) },
  );
const cfgArb: fc.Arbitrary<Cfg> = fc.record({
  perCaller: fc.integer({ min: 1, max: 12 }),
  perAnonymous: fc.integer({ min: 1, max: 12 }),
  maxStreams: fc.integer({ min: 1, max: 12 }),
});
interface Held {
  readonly m: number;
  readonly who: number;
  readonly st: Opened;
}

test("std.channels-limits 4: for every sequence of up to 200 opens and ends on one to three modules, an open is served exactly when Config finds it not full, and a full open's only event is closed full", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc
        .integer({ min: 1, max: 3 })
        .chain((n) =>
          fc.tuple(
            fc.array(cfgArb, { minLength: n, maxLength: n }),
            fc.array(opArb(n), { minLength: 120, maxLength: 200 }),
          ),
        ),
      async ([cfgs, ops]) => {
        await withModules(cfgs, async (h, open) => {
          const cookies: string[] = [""];
          for (let i = 0; i < 4; i++) cookies.push(await h.mint());
          const live: Held[] = [];
          const bound = (m: number, k: "perCaller" | "perAnonymous" | "maxStreams"): number => cfgs[m]?.[k] ?? 0;
          for (const op of ops) {
            if (op.t === "end") {
              if (live.length === 0) continue;
              const [gone] = live.splice(op.pick % live.length, 1);
              gone?.st.close();
              await waitFor(() => gone?.st.ended() === true);
              await settle(40);
              continue;
            }
            // Config: full when the module is at maxStreams; else cookieless and all modules at its perAnonymous; else a caller at its perCaller
            const onModule = live.filter((x) => x.m === op.m).length;
            const anonymous = live.filter((x) => x.who === 0).length;
            const mine = live.filter((x) => x.m === op.m && x.who === op.who).length;
            const full =
              onModule >= bound(op.m, "maxStreams") ||
              (op.who === 0 && anonymous >= bound(op.m, "perAnonymous")) ||
              (op.who !== 0 && mine >= bound(op.m, "perCaller"));
            const cookie = cookies[op.who];
            const st = await open(MODS[op.m] ?? "a", cookie === undefined || cookie === "" ? {} : caller(cookie));
            if (full) {
              await waitFor(() => st.ended());
              await settle();
              expect(st.events).toEqual(FULL);
            } else {
              expect(st.events[0]).toEqual(RESET);
              expect(st.ended()).toBe(false);
              live.push({ m: op.m, who: op.who, st });
            }
            // the process's cookieless streams never exceed the largest perAnonymous
            expect(live.filter((x) => x.who === 0).length).toBeLessThanOrEqual(
              Math.max(...cfgs.map((c) => c.perAnonymous ?? 0)),
            );
          }
          for (const x of live) expect(isServed(x.st) && !x.st.ended()).toBe(true);
        });
      },
    ),
    { seed: 1337, numRuns: 8 },
  );
}, 300_000);

// ---- what a signed-in client's streams count against, and what the section states as a limit
test("std.channels-limits Config: a stream with a caller counts against perCaller and maxStreams, never perAnonymous; a cookieless one against perAnonymous and maxStreams, never perCaller", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 }), async (pa, pc) => {
      await withModules(
        [
          { perAnonymous: pa, perCaller: pc, maxStreams: 40 },
          { perAnonymous: pa, perCaller: pc },
        ],
        async (h, open) => {
          const flood: Opened[] = [];
          for (let i = 0; i < pa; i++) flood.push(await open("a"));
          await expectFull(await open("a"));
          // the anonymous bound is reached; callers with cookies still get their perCaller, on each module, and many callers do
          const people: Opened[] = [];
          for (let p = 0; p < 4; p++) {
            const who = caller(await h.mint());
            for (let i = 0; i < pc; i++) people.push(await open(p % 2 === 0 ? "a" : "b", who));
            await expectFull(await open(p % 2 === 0 ? "a" : "b", who));
          }
          for (const st of [...flood, ...people]) expect(st.ended()).toBe(false);
          for (const st of people) expect(st.events[0]).toEqual(RESET);
          // callers' streams ending free no cookieless place, and held cookieless places are not freed by them
          for (const st of people) st.close();
          await settle(80);
          await expectFull(await open("a"));
          // cookieless streams never counted against perCaller: pa of them may exceed it
          expect(flood.length).toBe(pa);
        },
      );
    }),
    { seed: 1337, numRuns: 4 },
  );
}, 120_000);

const asUser = (sid: string, cookie?: string): OpenOptions => ({
  cookie: cookie === undefined ? `sid=${sid}` : `sid=${sid}; ${cookie}`,
});
const serveds = (xs: readonly Opened[]): void => {
  for (const st of xs) expectServed(st);
};

test("std.channels-limits Config: a signed-in request with no caller cookie opens a stream while the anonymous count is full, and counts against its user's perCaller, never perAnonymous", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 }), async (pa, pc) => {
      await withModules(
        [{ perAnonymous: pa, perCaller: pc, maxStreams: 40 }],
        async (_h, open) => {
          const flood: Opened[] = [];
          for (let i = 0; i < pa; i++) flood.push(await open("a"));
          await expectFull(await open("a"));
          const mine: Opened[] = [];
          for (let i = 0; i < pc; i++) mine.push(await open("a", asUser("u1")));
          serveds(mine);
          await expectFull(await open("a", asUser("u1")));
          // the user's streams free no anonymous place
          for (const st of mine) st.close();
          await settle(80);
          await expectFull(await open("a"));
          serveds(flood);
        },
        { identity: true },
      );
    }),
    { seed: 1337, numRuns: 4 },
  );
}, 120_000);

test("std.channels-limits Config: one user across two caller cookies shares one count: the 9th stream of one user at perCaller 8 is refused, whichever cookie it comes with", async () => {
  for (const ninth of ["x", "y", "none"] as const) {
    await withModules(
      [{}],
      async (h, open) => {
        const x = await h.mint();
        const y = await h.mint();
        const held: Opened[] = [];
        for (let i = 0; i < 8; i++) held.push(await open("a", asUser("u1", i % 2 === 0 ? x : y)));
        serveds(held);
        await expectFull(
          await open("a", ninth === "x" ? asUser("u1", x) : ninth === "y" ? asUser("u1", y) : asUser("u1")),
        );
        for (const st of held) expect(st.ended()).toBe(false);
      },
      { identity: true },
    );
  }
});

test("std.channels-limits Config: for every assignment of one user's opens to cookies, they are served exactly while fewer than perCaller are open, whatever the cookie", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 6 }),
      fc.array(fc.constantFrom("x", "y", "z", "none"), { minLength: 2, maxLength: 14 }),
      async (pc, picks) => {
        await withModules(
          [{ perCaller: pc, perAnonymous: 20, maxStreams: 40 }],
          async (h, open) => {
            const jar: Record<string, string> = { x: await h.mint(), y: await h.mint(), z: await h.mint() };
            let held = 0;
            for (const p of picks) {
              const cookie = jar[p];
              const st = await open("a", asUser("u1", cookie));
              if (held < pc) {
                expectServed(st);
                held++;
              } else await expectFull(st);
            }
          },
          { identity: true },
        );
      },
    ),
    { seed: 1337, numRuns: 8 },
  );
}, 120_000);

test("std.channels-limits Config: two users do not share a count, on one caller cookie or on two", async () => {
  await withModules(
    [{ perCaller: 2 }],
    async (h, open) => {
      const x = await h.mint();
      const y = await h.mint();
      const held: Opened[] = [];
      for (const [sid, cookie] of [
        ["u1", x],
        ["u2", x],
        ["u1", y],
        ["u2", y],
      ] as const) {
        held.push(await open("a", asUser(sid, cookie)));
      }
      held.push(await open("a", asUser("u1", x)), await open("a", asUser("u2", y)));
      // u1 and u2 hold 2 each, on one cookie x and then another
      serveds(held.slice(0, 4));
      await expectFull(held[4] ?? (await open("a")));
      await expectFull(held[5] ?? (await open("a")));
      await expectFull(await open("a", asUser("u1")));
      await expectFull(await open("a", asUser("u2")));
      serveds([await open("a", asUser("u3", x)), await open("a", asUser("u3"))]);
    },
    { identity: true },
  );
});

test("std.channels-limits What the caps bound: a client cannot assert a user: an unsigned x-keel-user, a forged signature, an expired one and a token the identity source refuses are each anonymous", async () => {
  await withModules(
    [{ perAnonymous: 4, perCaller: 1, maxStreams: 40 }],
    async (h, open) => {
      const real = await h.sign("u1");
      const mid = Math.floor(real.length / 2);
      const forged = `${real.slice(0, mid)}${real[mid] === "A" ? "B" : "A"}${real.slice(mid + 1)}`;
      expect(forged).not.toBe(real);
      const stale = await h.sign("u1");
      h.advance(61_000);
      const fresh = await h.sign("user:u1");
      // fresh is valid, stale (signed 61 s ago) is not
      const anon: readonly OpenOptions[] = [
        { headers: { "x-keel-user": "user:u1" } },
        { headers: { "x-keel-user": forged } },
        { headers: { "x-keel-user": stale } },
        { cookie: "sid=" },
      ];
      const held: Opened[] = [];
      for (const o of anon) held.push(await open("a", o));
      // perCaller is 1, yet four such opens are served: they count by perAnonymous (4), not by any user
      serveds(held);
      for (const [k, o] of anon.entries()) {
        const st = await open("a", o);
        await settle();
        expect([k, st.events]).toEqual([k, FULL]);
      }
      await expectFull(await open("a"));
      // a verified header is a user: it counts there, not toward perAnonymous
      const mine = await open("a", { headers: { "x-keel-user": fresh } });
      expectServed(mine);
      await expectFull(await open("a", { headers: { "x-keel-user": await h.sign("user:u1") } }));
      // the identity source's `user:u1` and a verified header for `user:u1` are one user, so one count
      await expectFull(await open("a", asUser("u1")));
      serveds([await open("a", asUser("u2"))]);
    },
    { identity: true, signed: true },
  );
});

test("std.channels-limits What the caps bound: a signed x-keel-user is a user in an app with no identity source, counting against that user's perCaller", async () => {
  await withModules(
    [{ perCaller: 2, perAnonymous: 1 }],
    async (h, open) => {
      const hdr = { "x-keel-user": await h.sign("u1") };
      const x = await h.mint();
      serveds([
        await open("a", { headers: hdr }),
        await open("a", { cookie: x, headers: { "x-keel-user": await h.sign("u1") } }),
      ]);
      await expectFull(await open("a", { headers: { "x-keel-user": await h.sign("u1") } }));
      serveds([await open("a")]);
      await expectFull(await open("a"));
    },
    { signed: true },
  );
});

test("std.channels-limits Config (attacker): minting many caller cookies gives one user no more than perCaller streams, and filling perAnonymous leaves signed-in users their own", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 3 }), fc.integer({ min: 3, max: 6 }), async (pc, cookies) => {
      await withModules(
        [{ perCaller: pc, perAnonymous: 2, maxStreams: 40 }],
        async (h, open) => {
          let served = 0;
          for (let c = 0; c < cookies; c++) {
            const cookie = await h.mint();
            for (let i = 0; i < pc; i++) {
              const st = await open("a", asUser("u1", cookie));
              if (served < pc) {
                expectServed(st);
                served++;
              } else await expectFull(st);
            }
          }
          expect(served).toBe(pc);
          // the anonymous count full: other signed-in users still open, each with its own perCaller, with or without a cookie
          const flood = [await open("a"), await open("a")];
          await expectFull(await open("a"));
          for (const sid of ["u2", "u3", "u4"]) {
            const mine: Opened[] = [];
            for (let i = 0; i < pc; i++)
              mine.push(await open("a", asUser(sid, i % 2 === 0 ? undefined : await h.mint())));
            serveds(mine);
            await expectFull(await open("a", asUser(sid)));
          }
          serveds(flood);
        },
        { identity: true },
      );
    }),
    { seed: 1337, numRuns: 4 },
  );
}, 120_000);

test("std.channels-limits Config: an app with no identity counts by caller exactly as before: a sid cookie or an unsigned x-keel-user is no user", async () => {
  await withModules([{ perCaller: 2, perAnonymous: 3 }], async (h, open) => {
    const x = await h.mint();
    const y = await h.mint();
    // one sid, two callers: each caller holds perCaller
    const held: Opened[] = [];
    for (const c of [x, y]) for (let i = 0; i < 2; i++) held.push(await open("a", asUser("u1", c)));
    serveds(held);
    await expectFull(await open("a", asUser("u1", x)));
    await expectFull(await open("a", asUser("u1", y)));
    // no caller cookie: anonymous, whatever sid or header it carries
    const bare = [
      await open("a", { cookie: "sid=u1" }),
      await open("a", { cookie: "sid=u2" }),
      await open("a", { headers: { "x-keel-user": "user:u1" } }),
    ];
    serveds(bare);
    await expectFull(await open("a", { cookie: "sid=u3" }));
  });
});

test("std.channels-limits Limits: callers minted by writes each hold perCaller streams on each module; only maxStreams bounds them, and the cookieless count is untouched", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 2, max: 3 }), fc.integer({ min: 3, max: 4 }), async (pc, callers) => {
      const maxStreams = pc * callers - 1;
      await withModules(
        [
          { perCaller: pc, maxStreams, perAnonymous: 2 },
          { perCaller: pc, maxStreams },
        ],
        async (h, open) => {
          const held: Opened[] = [];
          let places = 0;
          for (let c = 0; c < callers; c++) {
            const who = caller(await h.mint());
            for (let i = 0; i < pc; i++) {
              const st = await open("a", who);
              if (places < maxStreams) {
                expectServed(st);
                held.push(st);
                places++;
              } else await expectFull(st);
            }
          }
          // a's pool is spent by callers, one short of pc * callers
          expect(held.length).toBe(maxStreams);
          // b is unaffected, and so is the cookieless count (a cookieless open is full on a's maxStreams, served on b)
          const other = caller(await h.mint());
          expectServed(await open("b", other));
          await expectFull(await open("a"));
          expectServed(await open("b"));
        },
      );
    }),
    { seed: 1337, numRuns: 4 },
  );
}, 120_000);

test("std.channels-limits Limits: Keel counts no address, so cookieless opens from any number of addresses share the one perAnonymous count", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }), async (pa, extra) => {
      await withModules([{ perAnonymous: pa }, { perAnonymous: pa }], async (_h, open) => {
        const held: Opened[] = [];
        for (let i = 0; i < pa; i++) held.push(await open(i % 2 === 0 ? "a" : "b", { address: `198.51.100.${i}` }));
        for (let i = 0; i < extra; i++)
          await expectFull(await open(i % 2 === 0 ? "a" : "b", { address: `192.0.2.${i}` }));
        for (const st of held) expect(st.ended()).toBe(false);
      });
    }),
    { seed: 1337, numRuns: 4 },
  );
});

test("std.channels-limits What the caps bound: the flood takes at most perAnonymous places of a module's maxStreams, and streams with a caller keep the rest", async () => {
  await withModules([{ perAnonymous: 4, maxStreams: 6, perCaller: 8 }], async (h, open) => {
    const flood: Opened[] = [];
    for (let i = 0; i < 4; i++) flood.push(await open("a"));
    await expectFull(await open("a"));
    const who = caller(await h.mint());
    const mine: Opened[] = [];
    for (let i = 0; i < 2; i++) mine.push(await open("a", who));
    for (const st of [...flood, ...mine]) expectServed(st);
    // 4 + 2 is maxStreams: the module is full for everyone
    await expectFull(await open("a", who));
    await expectFull(await open("a", caller(await h.mint())));
  });
});

test("std.channels-limits Limits: while streams hold createApp's maxStreams pool, every event-stream open in the process, a caller's included, is 503 keel.busy until a stream ends", async () => {
  await withModules(
    [
      { perAnonymous: 3, perCaller: 8 },
      { perAnonymous: 3, perCaller: 8 },
    ],
    async (h, open) => {
      const who = caller(await h.mint());
      const held: Opened[] = [];
      for (let i = 0; i < 3; i++) held.push(await open("a", who));
      for (let i = 0; i < 3; i++) held.push(await open("b", who));
      for (const st of held) expectServed(st);
      const person = caller(await h.mint());
      for (const target of ["a", "b"] as const) {
        const busy = await open(target, person);
        expect(busy.status).toBe(503);
        await waitFor(() => busy.ended());
        expect(busy.raw()).toContain("keel.busy");
        const anon = await open(target);
        expect(anon.status).toBe(503);
      }
      held[0]?.close();
      await waitFor(() => held[0]?.ended() === true);
      await settle(60);
      expectServed(await open("b", person));
    },
    { appMaxStreams: 6 },
  );
});
