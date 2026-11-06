/** `<Name>.tsx` (k.component): a `Props` schema and one default export named like the file. */
export function componentTsx(name: string): string {
  return [
    `import { type Infer, s } from "@keel/schema";`,
    `import { Box } from "@keel/ui";`,
    "",
    "export const Props = s.object({});",
    "",
    `export default function ${name}(_props: Infer<typeof Props>) {`,
    "  return <Box />;",
    "}",
    "",
  ].join("\n");
}
