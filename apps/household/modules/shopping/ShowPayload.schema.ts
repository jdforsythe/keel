import { s } from "@keel/schema";

export const ShowPayload = s.object({ show: s.enum(["toBuy", "bought"]) });
