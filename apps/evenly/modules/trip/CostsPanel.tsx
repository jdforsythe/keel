import type { Ctx } from "@keel/ctx";
import { computed, signal } from "@keel/reactive";
import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { tx } from "@keel/store";
import { Box, Button, Input, Select, Text } from "@keel/ui";
import { addCost } from "./addCost.ts";
import euros from "./euros.ts";
import nameOf from "./nameOf.ts";
import splitEqually from "./splitEqually.ts";
import { trip } from "./trip.ts";

export const Props = s.object({});
export const uses = [addCost];

export default function CostsPanel(_props: Infer<typeof Props>, ctx: Ctx) {
  const title = signal("");
  const amount = signal("");
  const payer = signal("");
  const status = signal("");
  const payerId = computed(() => payer.get() || trip.get("people")[0]?.id || "");
  const add = () => {
    const whole = Number.parseInt(amount.get(), 10);
    const people = trip.get("people");
    const paid = people.find((p) => p.id === payerId.get());
    if (title.get().trim() === "" || !(whole > 0) || paid === undefined) {
      status.set("Give the cost a title, a whole-euro amount and a payer.");
      return;
    }
    const cents = whole * 100;
    const added = tx(addCost, {
      cost: {
        id: ctx.random.id("Cost"),
        title: title.get().trim(),
        cents,
        payer: paid.id,
        at: ctx.clock.now(),
        shares: splitEqually(
          cents,
          people.map((p) => p.id),
        ),
      },
    });
    if (!added.ok) {
      status.set("That cost did not fit the trip.");
      return;
    }
    title.set("");
    amount.set("");
    status.set("Cost added.");
  };
  return (
    <Box id="trip.costs" direction="column" gap="3">
      <If when={trip.get("costs").length === 0}>
        <Text id="trip.costs.empty">No costs yet. Add the first one below.</Text>
      </If>
      <Box as="ul" id="trip.costs.list" direction="column" gap="2">
        <For each={trip.get("costs")} key="id">
          {(c) => (
            <Box as="li" id={`trip.costs.${c.id}`}>
              {c.title}, {euros(c.cents)} EUR, paid by {nameOf(trip.get("people"), c.payer)}
            </Box>
          )}
        </For>
      </Box>
      <Input id="trip.costs.title" label="Title" autocomplete="off" value={title} onInput={(v) => title.set(v)} />
      <Input
        id="trip.costs.amount"
        label="Amount in whole euros"
        autocomplete="off"
        value={amount}
        onInput={(v) => amount.set(v)}
      />
      <Select
        id="trip.costs.payer"
        label="Paid by"
        options={trip.get("people").map((p) => ({ value: p.id, label: p.name }))}
        value={payerId}
        onChange={(v) => payer.set(v)}
      />
      <Button id="trip.costs.add" onClick={add}>
        Split it equally
      </Button>
      <Text id="trip.costs.status" role="status">
        {status.get()}
      </Text>
    </Box>
  );
}
