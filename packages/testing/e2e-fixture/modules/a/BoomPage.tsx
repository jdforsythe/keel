import { defect } from "@keel/schema";
import { Box, Button } from "@keel/ui";
export default function BoomPage() {
  return (
    <Box as="main">
      <Button id="a.boom.go" onClick={() => void Promise.resolve().then(() => defect("boom"))}>
        Go
      </Button>
    </Box>
  );
}
