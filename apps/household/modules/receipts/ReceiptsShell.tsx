import { type Infer, s } from "@keel/schema";
import { Box, Link } from "@keel/ui";
import Frame from "../members/Frame.tsx";
import { ShellData } from "../members/ShellData.schema.ts";
import { receipts } from "./receipts.contract.ts";

export const Props = s.object({ data: ShellData });

/** Layout `receipts.shell`: the frame around the receipts pages; the masthead links to the receipts book. */
export default function ReceiptsShell(props: Infer<typeof Props> & { readonly children: () => Node }) {
  return (
    <Frame
      data={props.data}
      nav={() => (
        <Box direction="row" align="center" gap="4">
          <Link id="receipts.nav.receipts" to={receipts.href("receipts.book", { locale: "en-US" })} fg="text">
            {props.data.text.receipts}
          </Link>
        </Box>
      )}
    >
      {props.children()}
    </Frame>
  );
}
