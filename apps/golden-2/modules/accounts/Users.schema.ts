import { s } from "@keel/schema";
import { User } from "./User.schema.ts";

export const Users = s.object({ users: s.array(User) });

export type Users = s.infer<typeof Users>;
