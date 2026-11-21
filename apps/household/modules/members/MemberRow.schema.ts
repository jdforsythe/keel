import { s } from "@keel/schema";
import { line } from "@keel/std-text";

/** One row of the `members` table as the profile reads it. */
export const MemberRow = s.object({
  email: s.string({ min: 3, max: 254 }).pii("contact"),
  name: line({ max: 100 }).pii("name"),
  phone: line({ max: 30 }).pii("contact").nullable(),
});
