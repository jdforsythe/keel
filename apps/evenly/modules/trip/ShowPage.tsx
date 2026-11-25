import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { type Infer, s } from "@keel/schema";
import { Tabs } from "@keel/std-headless";
import { Box, Heading } from "@keel/ui";
import AddPerson from "./AddPerson.tsx";
import BalancesPanel from "./BalancesPanel.tsx";
import CostsPanel from "./CostsPanel.tsx";

export const Props = s.object({});

export default function ShowPage(_props: Infer<typeof Props>, ctx: Ctx) {
  const tab = signal("costs");
  return (
    <Box as="main" id="trip.show" direction="column" gap="4" p="5">
      <Heading id="trip.show.title" level={1}>
        Your trip
      </Heading>
      <AddPerson />
      <Tabs
        id="trip.tabs"
        label="Trip"
        tabs={() => [
          { key: "costs", text: "Costs" },
          { key: "balances", text: "Balances" },
        ]}
        selected={() => tab.get()}
        onChange={(k) => tab.set(k)}
        panel={(k) => (k === "costs" ? <CostsPanel /> : <BalancesPanel />)}
      />
    </Box>
  );
}
