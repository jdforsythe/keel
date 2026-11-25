import { type Infer, s } from "@keel/schema";
import { Host } from "@keel/ui";
import { Bars } from "./Bars.schema.ts";

export const Props = s.object({ id: s.string(), label: s.string(), data: Bars });

/** A bar chart drawn by outside code into one `Host` element, `<id>.chart`; the bars reach it as its value. */
export default function BarChart(props: Infer<typeof Props>) {
  return (
    <Host
      id={`${props.id}.chart`}
      role="img"
      label={props.label}
      input={Bars}
      value={props.data}
      code={() => import("./barsCode.ts").then((m) => m.barsCode)}
    />
  );
}
