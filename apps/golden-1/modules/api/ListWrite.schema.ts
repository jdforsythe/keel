import { s } from "@keel/schema";
import { Write } from "@keel/std-offline";

/** Body of `POST /api/lists`: the new list's name and the write's `key`, `base` and `owner`. */
export const ListWrite = s.object({
  name: s.string({ min: 1, max: 60 }),
  write: Write,
});
export type ListWrite = s.infer<typeof ListWrite>;
