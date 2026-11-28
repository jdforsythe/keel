// Spec: std.tables, clause "For generated rows and searches, `applyQuery` is deterministic, `total` counts the filtered rows, its pages concatenate to the filtered sorted list, and each page has at most `pageSize` rows."
// Seed: 1337.
// std.tables, Rules "E2853 `pageSize` outside 1 to 500, `locale` not a `Locale`, or a key repeated or not id-safe"
// Assumption: `applyQuery` returns `{ rows, total, page, pages }` (tablePage); the rows are the input row objects.
import { s } from "@keel/schema";
import { applyQuery, columns } from "@keel/std-tables";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CURRENCIES, LOCALE, type Query, type Row, SEED, Search, catalogColumns, throwsCode } from "./fixtures.ts";

const TITLES = ["apple", "apricot", "banana", "cherry", "date", ""] as const;
const SORTS = ["title", "price", "minutes", "added"] as const;
const rowsArb = fc
  .array(
    fc.record({
      title: fc.constantFrom(...TITLES),
      price: fc.record({ minor: fc.integer({ min: 0, max: 4 }) }),
      minutes: fc.integer({ min: 0, max: 4 }),
      added: fc.constantFrom("2023-12-31", "2024-01-01", "2024-02-01"),
      currency: fc.constantFrom(...CURRENCIES),
      favorite: fc.boolean(),
    }),
    { maxLength: 30 },
  )
  // unique ids, deliberately not ascending in input order
  .map((rows): Row[] => rows.map((r, i) => ({ ...r, id: 1000 - i * 3 })));
const searchArb = fc
  .record(
    {
      sort: fc.constantFrom(...SORTS),
      dir: fc.constantFrom("asc", "desc"),
      page: fc.integer({ min: 1, max: 9 }),
      q: fc.constantFrom("a", "AP", "an", "Ban", "zz", "", "E"),
      currency: fc.constantFrom(...CURRENCIES),
      favorite: fc.boolean(),
    },
    { requiredKeys: [] },
  )
  .map((raw): Query => {
    const r = Search.parse(raw);
    if (!r.ok) throw new Error("fixture: generated search does not parse");
    return r.value;
  });
const sizeArb = fc.integer({ min: 1, max: 8 });

const lc = (v: string): string => v.toLocaleLowerCase(LOCALE);
const cmpBy = (sort: (typeof SORTS)[number], a: Row, b: Row): number => {
  if (sort === "price") return a.price.minor - b.price.minor;
  if (sort === "minutes") return a.minutes - b.minutes;
  const [x, y] = sort === "title" ? [a.title, b.title] : [a.added, b.added];
  return x < y ? -1 : x > y ? 1 : 0;
};
/** The spec's filtered, sorted list, computed independently (titles and dates are ASCII lowercase, so `<` is the collation). */
const expected = (rows: readonly Row[], q: Query): Row[] => {
  const kept = rows.filter(
    (r) =>
      (q.q === undefined || lc(r.title).includes(lc(q.q))) &&
      (q.currency === undefined || r.currency === q.currency) &&
      (q.favorite === undefined || r.favorite === q.favorite),
  );
  const { sort } = q;
  if (sort === undefined) return kept;
  const sign = q.dir === "desc" ? -1 : 1;
  return [...kept].sort((a, b) => sign * cmpBy(sort, a, b) || a.id - b.id);
};

describe("std.tables: applyQuery", () => {
  test("For generated rows and searches, `applyQuery` is deterministic, `total` counts the filtered rows, its pages concatenate to the filtered sorted list, and each page has at most `pageSize` rows", () => {
    fc.assert(
      fc.property(rowsArb, searchArb, sizeArb, (rows, search, pageSize) => {
        const run = (page: number | undefined) =>
          applyQuery(catalogColumns, rows, page === undefined ? search : { ...search, page }, {
            pageSize,
            locale: LOCALE,
          });
        const first = run(search.page);
        expect(run(search.page)).toEqual(first); // deterministic
        const want = expected(rows, search);
        expect(first.total).toBe(want.length);
        const pages = Math.max(1, Math.ceil(want.length / pageSize));
        expect(first.pages).toBe(pages);
        expect(first.page).toBe(Math.min(Math.max(search.page ?? 1, 1), pages)); // clamped
        const all: Row[] = [];
        for (let p = 1; p <= pages; p++) {
          const got = run(p);
          expect(got.rows.length).toBeLessThanOrEqual(pageSize);
          expect(got.total).toBe(want.length);
          all.push(...got.rows);
        }
        expect(all).toEqual(want);
        expect(run(pages + 3).rows).toEqual(run(pages).rows); // a page past the end is the last page
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  const Tagged = s.object({ id: s.string(), n: s.int() });
  const tagged = columns(Tagged, { key: "id", show: ["id", "n"], sort: ["n"] });
  const rowsOf = (ids: readonly string[]) => ids.map((id, n) => ({ id, n }));
  const apply = (rows: ReturnType<typeof rowsOf>, pageSize: number) =>
    applyQuery(tagged, rows, {}, { pageSize, locale: LOCALE });

  test("E2853 `pageSize` outside 1 to 500, or a key repeated or not id-safe", () => {
    // pageSize outside 1 to 500 throws; inside it does not
    fc.assert(
      fc.property(fc.oneof(fc.integer({ min: -1000, max: 0 }), fc.integer({ min: 501, max: 5000 })), (pageSize) => {
        expect(throwsCode(() => apply(rowsOf(["a", "b"]), pageSize))).toBe("E2853");
      }),
      { seed: SEED, numRuns: 100 },
    );
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), (pageSize) => {
        expect(throwsCode(() => apply(rowsOf(["a", "b"]), pageSize))).toBeUndefined();
      }),
      { seed: SEED, numRuns: 100 },
    );
    // a repeated key throws
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9_-]{1,64}$/),
        fc.stringMatching(/^[A-Za-z0-9_-]{1,8}$/),
        (key, other) => {
          expect(throwsCode(() => apply(rowsOf([key, `${other}-x`, key]), 5))).toBe("E2853");
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
    // a key that is not id-safe throws: empty, a space, a dot, non-ASCII, or over 64 characters
    for (const key of ["", "a b", "a.b", "é", "a/b", "x".repeat(65)]) {
      expect(throwsCode(() => apply(rowsOf(["ok", key]), 5))).toBe("E2853");
    }
    for (const key of ["a", "A_b-9", "x".repeat(64)]) {
      expect(throwsCode(() => apply(rowsOf([key]), 5))).toBeUndefined();
    }
  });
});
