import { s } from "@keel/schema";

/** One dev-server request (k.server log stream): compact `GET /orders/7 orders.show 200 12ms`. */
export const ReqSchema = s.object({
  kind: s.literal("req"),
  method: s.string(),
  path: s.string(),
  route: s.string().optional(),
  status: s.int(),
  ms: s.number(),
});
