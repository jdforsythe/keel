import { s } from "@keel/schema";
import { Profile } from "./Profile.schema.ts";

export const Profiles = s.object({ profiles: s.array(Profile) });

export type Profiles = s.infer<typeof Profiles>;
