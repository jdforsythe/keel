import { Box, Text } from "@keel/ui";
export default function List(props) {
  return <Box as="ul">{props.open && <Text>x</Text>}</Box>;
}
