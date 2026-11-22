import { type Infer, s } from "@keel/schema";
import { Box, Heading } from "@keel/ui";
import { Item } from "./Item.schema.ts";
import { ListText } from "./ListText.schema.ts";
import ShoppingList from "./ShoppingList.tsx";

export const Props = s.object({ data: s.object({ text: ListText, items: s.array(Item) }) });

export default function ListPage(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="shopping.page" direction="column" gap="4">
      <Heading id="shopping.heading" level={1} m="0" fontSize={{ base: "xl", md: "2xl" }} weight="semibold">
        {props.data.text.heading}
      </Heading>
      <ShoppingList text={props.data.text} items={props.data.items} />
    </Box>
  );
}
