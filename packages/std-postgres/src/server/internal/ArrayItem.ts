/** An element of a Postgres array literal: its text, `null` for `NULL`, or a nested array. */
export type ArrayItem = string | null | readonly ArrayItem[];
