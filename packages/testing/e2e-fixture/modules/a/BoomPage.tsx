import { Box, Button } from "@keel/ui";
export default function BoomPage() {
  return (
    <Box as="main">
      <Button id="a.boom.go" onClick={() => void Promise.reject(new Error("boom"))}>
        Go
      </Button>
    </Box>
  );
}
