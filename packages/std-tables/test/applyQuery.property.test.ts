// `applyQuery` over rows and searches generated from the row schema and its `tableSearch` (`gen`). Seed 1337.
import { type Infer, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import { type Locale, collate } from "@keel/std-i18n";
import { applyQuery, columns, tableSearch } from "@keel/std-tables";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const LOCALE: Locale = "de-DE";
const Row = s.object({
  id: s.int({ min: 1 }),
  name: s.string({ max: 6 }),
  n: s.number({ min: -5, max: 5 }),
  tag: s.enum(["low", "mid", "high"]),
  on: s.boolean(),
  meta: s.object({ w: s.int({ min: 0, max: 3 }) }),
});
type R = Infer<typeof Row>;
const cols = columns(Row, {
  key: "id",
  show: ["name", "n", "tag", "on", "meta"],
  sort: ["name", "n", "tag", "on", "meta"],
  search: ["name"],
  filter: ["tag", "on"],
  compare: { meta: (a, b) => a.w - b.w },
});
const Search = tableSearch(cols);
const TAGS: readonly string[] = ["low", "mid", "high"];

// ids made unique and out of input order
const rowsArb = fc.array(gen(Row), { maxLength: 40 }).map((rows) => rows.map((r, i): R => ({ ...r, id: 900 - 7 * i })));
const searchArb = gen(Search);
const sizeArb = fc.integer({ min: 1, max: 9 });
const order = (sort: string, a: R, b: R): number => {
  if (sort === "name") return Math.sign(collate(a.name, b.name, LOCALE));
  if (sort === "n") return Math.sign(a.n - b.n);
  if (sort === "tag") return Math.sign(TAGS.indexOf(a.tag) - TAGS.indexOf(b.tag));
  if (sort === "on") return Number(a.on) - Number(b.on);
  return Math.sign(a.meta.w - b.meta.w);
};

describe("applyQuery", () => {
  test("every generated search parses, and its result is a total, ordered, clamped page of the filtered rows", () => {
    fc.assert(
      fc.property(rowsArb, searchArb, sizeArb, (rows, search, pageSize) => {
        expect(Search.parse(search).ok).toBe(true);
        const opts = { pageSize, locale: LOCALE };
        const first = applyQuery(cols, rows, search, opts);
        expect(applyQuery(cols, rows, search, opts)).toEqual(first);
        const q = search.q?.toLocaleLowerCase(LOCALE);
        const kept = rows.filter(
          (r) =>
            (q === undefined || r.name.toLocaleLowerCase(LOCALE).includes(q)) &&
            (search.tag === undefined || r.tag === search.tag) &&
            (search.on === undefined || r.on === search.on),
        );
        expect(first.total).toBe(kept.length);
        expect(first.pages).toBe(Math.max(1, Math.ceil(kept.length / pageSize)));
        expect(first.page).toBeGreaterThanOrEqual(1);
        expect(first.page).toBeLessThanOrEqual(first.pages);
        const all: R[] = [];
        for (let p = 1; p <= first.pages; p++) {
          const got = applyQuery(cols, rows, { ...search, page: p }, opts);
          expect(got.page).toBe(p);
          expect(got.rows.length).toBeLessThanOrEqual(pageSize);
          if (p < got.pages) expect(got.rows.length).toBe(pageSize);
          all.push(...got.rows);
        }
        // the same rows, by identity, as the filter kept
        expect(new Set(all)).toEqual(new Set(kept));
        expect(all).toHaveLength(kept.length);
        const { sort } = search;
        if (sort === undefined) expect(all).toEqual(kept);
        else {
          const dir = search.dir === "desc" ? -1 : 1;
          for (let i = 1; i < all.length; i++) {
            const a = all[i - 1];
            const b = all[i];
            if (a === undefined || b === undefined) continue;
            const c = dir * order(sort, a, b);
            expect(c < 0 || (c === 0 && a.id < b.id)).toBe(true);
          }
        }
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  test("a page outside 1 to pages is clamped, and the input array is not reordered", () => {
    fc.assert(
      fc.property(rowsArb, fc.integer({ min: -3, max: 20 }), (rows, page) => {
        const before = [...rows];
        const out = applyQuery(cols, rows, { sort: "n", dir: "desc", page }, { pageSize: 4, locale: LOCALE });
        expect(out.page).toBe(Math.min(Math.max(page, 1), out.pages));
        expect(rows).toEqual(before);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
