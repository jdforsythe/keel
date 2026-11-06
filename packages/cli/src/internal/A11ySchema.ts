import { s } from "@keel/schema";

/** One a11y tree node, flattened in document order; `depth` carries the tree shape (schemas are not recursive). */
export const A11ySchema = s.object({
  kind: s.literal("a11y"),
  id: s.string(),
  role: s.string(),
  name: s.string(),
  depth: s.int(),
  state: s.object({
    checked: s.boolean().optional(),
    disabled: s.boolean().optional(),
    expanded: s.boolean().optional(),
    selected: s.boolean().optional(),
    invalid: s.boolean().optional(),
    focused: s.boolean().optional(),
  }),
});
