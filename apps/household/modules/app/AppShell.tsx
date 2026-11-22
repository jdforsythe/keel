import { type Infer, s } from "@keel/schema";
import { Box, Link } from "@keel/ui";
import Frame from "../members/Frame.tsx";
import { ShellData } from "../members/ShellData.schema.ts";
import { receipts } from "../receipts/receipts.contract.ts";
import { shopping } from "../shopping/shopping.contract.ts";

export const Props = s.object({ data: ShellData });

/** Layout `app.shell`: the frame around the app pages; the masthead links to the list and the receipts book. */
export default function AppShell(props: Infer<typeof Props> & { readonly children: () => Node }) {
  return (
    <Frame
      data={props.data}
      nav={() => (
        <Box direction="row" align="center" gap="4">
          <Link id="app.nav.list" to={shopping.href("shopping.list")} fg="text">
            {props.data.text.list}
          </Link>
          <Link id="app.nav.receipts" to={receipts.href("receipts.book", { locale: "en-US" })} fg="text">
            {props.data.text.receipts}
          </Link>
        </Box>
      )}
    >
      {props.children()}
    </Frame>
  );
}
