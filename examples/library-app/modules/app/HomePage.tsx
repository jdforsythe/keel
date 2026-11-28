import { BarChart } from "@example/library-charts";
import { Badge, Card, Switch } from "@example/library-looks";
import { signal } from "@keel/reactive";
import { Box, Heading, SchemeSelect, Text, ThemeSelect } from "@keel/ui";

const RAIN = {
  bars: [
    { name: "April", value: 40 },
    { name: "May", value: 65 },
    { name: "June", value: 25 },
  ],
};

export default function HomePage() {
  const alerts = signal(false);
  return (
    <Box as="main" id="app.home" direction="column" gap="2" p="4">
      <Heading id="app.home.title" level={1}>
        Rainfall
      </Heading>
      <BarChart id="app.rain" label="Rainfall by month, in millimeters" data={RAIN} />
      <Card id="app.alerts" title="Rain alerts">
        <Box id="app.alerts.parts" direction="row" gap="2" align="center">
          <Badge id="app.alerts.badge" text="Beta" />
          <Switch
            id="app.alerts.toggle"
            label="Alert me when it rains"
            on={() => alerts.get()}
            onToggle={() => alerts.set(!alerts.get())}
          />
        </Box>
      </Card>
      <Box id="app.appearance" direction="column" gap="2" media="screen">
        <SchemeSelect
          id="app.scheme"
          label="Color scheme"
          labels={{ system: "System", light: "Light", dark: "Dark" }}
        />
        <ThemeSelect id="app.theme" label="Theme" labels={{ default: "Keel", slate: "Slate" }} />
      </Box>
      <Text id="app.printed" as="p" media="print" breakBefore="avoid">
        Printed from the rainfall page.
      </Text>
    </Box>
  );
}
