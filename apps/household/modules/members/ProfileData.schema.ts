import { s } from "@keel/schema";
import { line } from "@keel/std-text";
import { ProfileText } from "./ProfileText.schema.ts";
import { TokenInfo } from "./TokenInfo.schema.ts";

/** What the profile page loads: its copy, the member's details and their API tokens. */
export const ProfileData = s.object({
  text: ProfileText,
  email: s.string({ min: 3, max: 254 }).pii("contact"),
  name: line({ max: 100 }).pii("name"),
  phone: line({ max: 30 }).pii("contact").optional(),
  tokens: s.array(TokenInfo),
});
