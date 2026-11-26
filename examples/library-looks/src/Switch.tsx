import { type Infer, s } from "@keel/schema";
import { Box } from "@keel/ui";
import { Part } from "@keel/ui/aria";

export const Props = s.object({ id: s.string(), label: s.string({ min: 1 }) });

export default function Switch(
  props: Infer<typeof Props> & { readonly on: () => boolean; readonly onToggle: () => void },
) {
  return (
    <Part
      id={`${props.id}.switch`}
      role="switch"
      label={props.label}
      checked={props.on()}
      onClick={props.onToggle}
      look="acme.switch"
      // biome-ignore lint/correctness/noChildrenProp: a Keel slot is a function prop (k.component)
      children={() => <Box id={`${props.id}.knob`} look="acme.knob" />}
    />
  );
}
