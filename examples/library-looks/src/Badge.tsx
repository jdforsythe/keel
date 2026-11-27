import { type Infer, s } from "@keel/schema";
import { Text } from "@keel/ui";

export const Props = s.object({ id: s.string(), text: s.string({ min: 1 }) });

export default function Badge(props: Infer<typeof Props>) {
  return (
    <Text id={`${props.id}.text`} as="span" look="acme.badge">
      {props.text}
    </Text>
  );
}
