import type { Ctx } from "@keel/ctx";
import { s } from "@keel/schema";
import { record } from "@keel/std-sessions/record";
import { Box, Link } from "@keel/ui";
import { pageOrigin } from "./pageOrigin.ts";
import { shifts } from "./shifts.contract.ts";

export const Props = s.object({});

export default function AppShell(props: { readonly children: () => Node }, ctx: Ctx) {
  const origin = pageOrigin();
  if (origin !== undefined) record(ctx, { upload: new URL("/sessions", origin) });
  return (
    <Box id="shifts.shell" direction="column" gap="3" p="3">
      <Box as="nav" id="shifts.nav" label="Main" direction="row" gap="3">
        <Link id="shifts.home" to={shifts.href("shifts.index")}>
          Shifts
        </Link>
        <Link id="shifts.mineLink" to={shifts.href("shifts.mine")}>
          My sign-ups
        </Link>
      </Box>
      <Box as="main" id="shifts.main" direction="column" gap="3">
        {props.children()}
      </Box>
    </Box>
  );
}
