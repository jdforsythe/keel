import { s } from "@keel/schema";
import { Session } from "./Session.schema.ts";

export const Sessions = s.object({ sessions: s.array(Session) });

export type Sessions = s.infer<typeof Sessions>;
