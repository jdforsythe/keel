import { type Infer, s } from "@keel/schema";
import { Part } from "@keel/ui/aria";

export const Props = s.object({ id: s.string(), text: s.string({ min: 1 }) });

export default function Toggle(
  props: Infer<typeof Props> & { readonly pressed: () => boolean; readonly onToggle: () => void },
) {
  return (
    <Part
      id={`${props.id}.toggle`}
      role="button"
      pressed={props.pressed()}
      onClick={props.onToggle}
      look="acme.toggle"
      // biome-ignore lint/correctness/noChildrenProp: a Keel slot is a function prop (k.component)
      children={() => props.text}
    />
  );
}
