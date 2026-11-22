import { type Infer, s } from "@keel/schema";
import { Box, Link } from "@keel/ui";
import Frame from "../members/Frame.tsx";
import { ShellData } from "../members/ShellData.schema.ts";
import { receipts } from "../receipts/receipts.contract.ts";
import { shopping } from "./shopping.contract.ts";

export const Props = s.object({ data: ShellData });

/** Layout `shopping.shell`: the frame around the shopping pages; the masthead links to the list and the receipts book. */
export default function ShoppingShell(props: Infer<typeof Props> & { readonly children: () => Node }) {
  return (
    <Frame
      data={props.data}
      nav={() => (
        <Box direction="row" align="center" gap="4">
          <Link id="shopping.nav.list" to={shopping.href("shopping.list")} fg="text">
            {props.data.text.list}
          </Link>
          <Link id="shopping.nav.receipts" to={receipts.href("receipts.book", { locale: "en-US" })} fg="text">
            {props.data.text.receipts}
          </Link>
        </Box>
      )}
    >
      {props.children()}
    </Frame>
  );
}
