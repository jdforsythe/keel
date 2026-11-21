/** One entry of a contract: its file, `path` (null for layouts) and `method` (null for pages and layouts). */
export type RouteDef = { file: string; path: string | null; method: string | null };
