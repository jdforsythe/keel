/**
 * `src/Example.tsx` of a library: its `Props` schema (k.testing renders by it) and one `Text` whose id is built from
 * the component's `id` prop (k.library Ids, E1161).
 */
export function libraryExampleTsx(): string {
  return [
    `import { s } from "@keel/schema";`,
    `import { Text } from "@keel/ui";`,
    "",
    "export const Props = s.object({ id: s.string() });",
    "",
    "/** Renders `<id>.text`; an app gives the `id`, so every element id it holds starts with the app's. */",
    "export default function Example(props: { id: string }) {",
    "  return <Text id={`${props.id}.text`}>Example</Text>;",
    "}",
    "",
  ].join("\n");
}
