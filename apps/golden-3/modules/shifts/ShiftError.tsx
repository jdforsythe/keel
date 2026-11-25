import { s } from "@keel/schema";
import { Box, Heading } from "@keel/ui";

export const Props = s.object({});

export default function ShiftError() {
  return (
    <Box id="shifts.errorPage">
      <Heading id="shifts.error" level={1}>
        Not found
      </Heading>
    </Box>
  );
}
