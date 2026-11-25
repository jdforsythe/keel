import { BarChart } from "@example/library-charts";
import { Box, Heading } from "@keel/ui";

const RAIN = {
  bars: [
    { name: "April", value: 40 },
    { name: "May", value: 65 },
    { name: "June", value: 25 },
  ],
};

export default function HomePage() {
  return (
    <Box as="main" id="app.home" direction="column" gap="2" p="4">
      <Heading id="app.home.title" level={1}>
        Rainfall
      </Heading>
      <BarChart id="app.rain" label="Rainfall by month, in millimeters" data={RAIN} />
    </Box>
  );
}
