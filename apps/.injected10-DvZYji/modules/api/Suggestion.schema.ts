import { s } from "@keel/schema";

/** A suggested todo title served by `GET /api/suggestions`. */
export const Suggestion = s.object({
  title: s.string({ min: 1, max: 120 }),
});
export type Suggestion = s.infer<typeof Suggestion>;
