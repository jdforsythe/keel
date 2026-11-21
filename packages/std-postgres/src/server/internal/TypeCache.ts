import type { Conn } from "./Conn.ts";

const LOAD = "select oid::int8::text, typelem::int8::text, typdelim::text, typcategory::text from pg_type";

/**
 * The types an engine knows, read from `pg_type`: every oid (PGlite is told to keep each as text) and, for an array
 * type, its element oid and delimiter. `load` reads them again, as after a migration creates a type.
 */
export class TypeCache {
  readonly known = new Set<number>();
  readonly arrays = new Map<number, { readonly elem: number; readonly delim: string }>();
  readonly parsers: Record<number, (v: string) => string> = {};

  async load(c: Conn): Promise<void> {
    const raw = await c.query(LOAD, []);
    for (const row of raw.rows) {
      const [oid, elem, delim, category] = row.map((v) => String(v));
      const id = Number(oid);
      this.known.add(id);
      this.parsers[id] = keep;
      if (category === "A") this.arrays.set(id, { elem: Number(elem), delim: delim ?? "," });
    }
  }
}

const keep = (v: string): string => v;
