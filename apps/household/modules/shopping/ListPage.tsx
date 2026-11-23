import { type Infer, s } from "@keel/schema";
import { Box, Heading } from "@keel/ui";
import { ListData } from "./ListData.schema.ts";
import ShoppingList from "./ShoppingList.tsx";

export const Props = s.object({ data: ListData });

export default function ListPage(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="shopping.page" direction="column" gap="4">
      <Heading id="shopping.heading" level={1} fontSize={{ base: "xl", md: "2xl" }}>
        {props.data.text.heading}
      </Heading>
      <ShoppingList text={props.data.text} items={props.data.items} member={props.data.member} />
    </Box>
  );
}
