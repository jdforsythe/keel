import { type Infer, s } from "@keel/schema";
import { Box, Heading } from "@keel/ui";
import { Item } from "./Item.schema.ts";
import { ListText } from "./ListText.schema.ts";
import ShoppingList from "./ShoppingList.tsx";

export const Props = s.object({ data: s.object({ text: ListText, items: s.array(Item) }) });

export default function ListPage(props: Infer<typeof Props>) {
  return (
    <Box as="main" id="shopping.page" p="4" gap="3">
      <Heading id="shopping.heading" level={1}>
        {props.data.text.heading}
      </Heading>
      <ShoppingList text={props.data.text} items={props.data.items} />
    </Box>
  );
}
