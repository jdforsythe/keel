/**
 * `<Name>.tsx` (k.component): a `Props` schema and one default export named like the file. `ctx` adds the second
 * parameter `ctx: Ctx` (k.ctx), for a component that reaches an effect; without it the component takes `props` alone.
 */
export function componentTsx(name: string, ctx = false): string {
  return [
    ...(ctx ? [`import type { Ctx } from "@keel/ctx";`] : []),
    `import { type Infer, s } from "@keel/schema";`,
    `import { Box } from "@keel/ui";`,
    "",
    "export const Props = s.object({});",
    "",
    `export default function ${name}(_props: Infer<typeof Props>${ctx ? ", _ctx: Ctx" : ""}) {`,
    "  return <Box />;",
    "}",
    "",
  ].join("\n");
}
