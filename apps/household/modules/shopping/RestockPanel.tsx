import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { type Infer, s } from "@keel/schema";
import { type LiveStatus, live } from "@keel/std-live";
import { UTC, formatInstant } from "@keel/std-temporal";
import { tx } from "@keel/store";
import { Box, Button, Heading, Text } from "@keel/ui";
import { RestockText } from "./RestockText.schema.ts";
import { Runs } from "./Runs.schema.ts";
import { hydrateRuns } from "./hydrateRuns.transaction.ts";
import { pageOrigin } from "./pageOrigin.ts";
import { runsChannel } from "./runsChannel.schema.ts";
import { runsCopy } from "./runsCopy.store.ts";
import { shoppingApi } from "./shoppingApi.ts";

export const Props = s.object({ text: RestockText, runs: Runs });
export const uses = [hydrateRuns];

export default function RestockPanel(props: Infer<typeof Props>, ctx: Ctx) {
  const refused = signal(false);
  // The panel follows the runs channel: each save of a run, by a step job or a member's Run now, re-reads the runs
  // into `shopping.runsCopy`. The server render has no stream and shows the loader's runs until the first read commits.
  const origin = pageOrigin();
  const status =
    origin === undefined
      ? (): LiveStatus => "connecting"
      : live(
          ctx,
          origin,
          runsChannel,
          {},
          { read: (c, abort) => shoppingApi.runs({ signal: abort }, c), hydrate: hydrateRuns },
        );
  const runs = () => (runsCopy.get("read") ? runsCopy.get("runs") : props.runs);
  const running = () => runs().last?.state === "running";
  const summary = () => {
    const last = runs().last;
    if (last === null) return props.text.never;
    const counts = `${last.handled} ${props.text.of} ${last.total} ${props.text.handled}, ${last.putBack} ${props.text.putBack}`;
    const end = last.state === "failed" ? `. ${props.text.failedWith} ${last.code}` : "";
    return `${props.text.states[last.state]}: ${counts}${end}.`;
  };
  const started = () => {
    const last = runs().last;
    return last === null ? "" : `${props.text.by[last.by]}, ${formatInstant(last.at, "en-US", UTC, "medium")} UTC`;
  };
  const runNow = async () => {
    const r = await shoppingApi.run({}, ctx);
    const saved = r.ok ? tx(hydrateRuns, r.value) : r;
    refused.set(!saved.ok);
  };
  return (
    <Box
      as="section"
      id="shopping.restock"
      direction="column"
      gap="3"
      p={{ base: "3", md: "4" }}
      bg="card"
      border="hairline"
    >
      <Heading id="shopping.restock.heading" level={2} fontSize={{ base: "lg", md: "xl" }}>
        {props.text.heading}
      </Heading>
      <Text id="shopping.restock.intro" fg="textSecondary">
        {props.text.intro}
      </Text>
      <Box direction="row">
        <Text
          id="shopping.restock.live"
          role="status"
          font="mono"
          fontSize="xs"
          px="2"
          py="1"
          bg="card"
          fg={status() === "live" ? "verified" : status() === "offline" ? "error" : "textSecondary"}
          border={status() === "live" ? "verified" : status() === "offline" ? "error" : "accent"}
        >
          {props.text.live[status()]}
        </Text>
      </Box>
      <Box direction="column" gap="1" px="3" py="2" bg="surfaceLow" border={running() ? "accent" : "hairline"}>
        <Text
          id="shopping.restock.last"
          role="status"
          font="mono"
          fontSize="sm"
          fg={runs().last?.state === "failed" ? "error" : "text"}
        >
          {summary()}
        </Text>
        <Text id="shopping.restock.started" font="mono" fontSize="xs" fg="textSecondary">
          {started()}
        </Text>
      </Box>
      <Box direction="row">
        <Button id="shopping.restock.run" onClick={() => runNow()}>
          {props.text.runNow}
        </Button>
      </Box>
      <Text id="shopping.restock.refused" role="alert" fg="error" font="mono" fontSize="sm">
        {refused.get() ? props.text.refused : ""}
      </Text>
    </Box>
  );
}
