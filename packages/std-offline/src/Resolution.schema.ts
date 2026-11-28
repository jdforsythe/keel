import { s } from "@keel/schema";

/** A user's answer to a refused entry (std.offline Resolve): `mine` sends it again over the conflict, `theirs` drops it. */
const ResolutionShape = s.enum(["mine", "theirs"]);
export const Resolution: typeof ResolutionShape = ResolutionShape;
export type Resolution = s.infer<typeof ResolutionShape>;
