import { s } from "@keel/schema";
import { line } from "@keel/std-text";

/** The profile form: the name the household sees and a phone number the others can call. */
export const Profile = s.object({
  name: line({ max: 100 }).pii("name"),
  phone: line({ max: 30 }).pii("contact").optional(),
});
