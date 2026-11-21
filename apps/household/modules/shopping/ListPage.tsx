import { type Infer, s } from "@keel/schema";
import { Box, Heading } from "@keel/ui";
import { ListText } from "./ListText.schema.ts";
import ShoppingList from "./ShoppingList.tsx";

export const Props = s.object({ data: s.object({ text: ListText }) });

export default function ListPage(props: Infer<typeof Props>) {
  return (
    <Box as="main" id="shopping.page" p="4" gap="3">
      <Heading id="shopping.heading" level={1}>
        {props.data.text.heading}
      </Heading>
      <ShoppingList text={props.data.text} />
    </Box>
  );
}
