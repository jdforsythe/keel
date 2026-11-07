import { s } from "@keel/schema";

export const KeelFields = s.object({
  code: s.literal("keel.fields"),
  message: s.string(),
  data: s.record(s.string()),
});

export type KeelFields = s.infer<typeof KeelFields>;
