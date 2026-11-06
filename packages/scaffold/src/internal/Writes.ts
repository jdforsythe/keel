/** Pending writes of one operation: path -> new content, or null to remove. Insertion order is irrelevant. */
export type Writes = Map<string, string | null>;
