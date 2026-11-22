import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import { members } from "../members/members.contract.ts";
import { receipts } from "../receipts/receipts.contract.ts";
import { setup } from "../setup/setup.contract.ts";
import { shopping } from "../shopping/shopping.contract.ts";
import { StartData } from "./StartData.schema.ts";

export const Props = s.object({ data: StartData });

export default function StartPage(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="app.start" direction="column" gap="4">
      <Heading id="app.start.heading" level={1} m="0" fontSize={{ base: "xl", md: "2xl" }} weight="semibold">
        {props.data.heading}
      </Heading>
      <Text id="app.start.intro" fg="textSecondary">
        {props.data.intro}
      </Text>
      <Box as="ul" id="app.start.links" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <Box as="li" direction="row" px="3" py="3" bg="card">
          <Link id="app.start.toList" to={shopping.href("shopping.list")} fg="text" fontSize="lg">
            {props.data.toList}
          </Link>
        </Box>
        <Box as="li" direction="row" px="3" py="3" bg="card">
          <Link
            id="app.start.toReceipts"
            to={receipts.href("receipts.book", { locale: "en-US" })}
            fg="text"
            fontSize="lg"
          >
            {props.data.toReceipts}
          </Link>
        </Box>
        <Box as="li" direction="row" px="3" py="3" bg="card">
          <Link id="app.start.toSetup" to={setup.href("setup.form")} fg="text" fontSize="lg">
            {props.data.toSetup}
          </Link>
        </Box>
        <Box as="li" direction="row" px="3" py="3" bg="card">
          <Link id="app.start.toProfile" to={members.href("members.profile")} fg="text" fontSize="lg">
            {props.data.toProfile}
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
