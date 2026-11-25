import { s } from "@keel/schema";
import { Text } from "@keel/ui";

export const Props = s.object({ id: s.string() });

/** Renders `<id>.text`; an app gives the `id`, so every element id it holds starts with the app's. */
export default function Example(props: { id: string }) {
  return <Text id={`${props.id}.text`}>Example</Text>;
}
