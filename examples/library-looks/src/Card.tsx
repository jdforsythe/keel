import { type Infer, s } from "@keel/schema";
import { Box, type Child, Heading } from "@keel/ui";

export const Props = s.object({ id: s.string(), title: s.string({ min: 1 }) });

export default function Card(props: Infer<typeof Props> & { readonly children: () => Child }) {
  return (
    <Box id={`${props.id}.card`} as="section" look="acme.card">
      <Heading id={`${props.id}.title`} level={2} fg="acme.text">
        {props.title}
      </Heading>
      {/* biome-ignore lint/correctness/noChildrenProp: a Keel slot is a function prop (k.component) */}
      <Box id={`${props.id}.body`} children={props.children} />
    </Box>
  );
}
