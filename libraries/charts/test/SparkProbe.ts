import { type Infer, s } from "@keel/schema";
import { Sparkline, ChartText, Point } from "../src/index.ts";

export const Props = s.object({
  label: s.string({ min: 1 }),
  summary: s.string({ min: 1 }),
  points: s.array(Point),
  text: ChartText,
});

/** `Sparkline` under a fixed element id, so a property run varies what an app varies: the words and the points. */
export default function SparkProbe(props: Infer<typeof Props>): Node {
  return Sparkline({ id: "probe", label: props.label, summary: props.summary, points: props.points, text: props.text });
}

// test/ is never compiled (the plugin skips it), so the schema the compiler attaches to a src/ component is attached here.
SparkProbe.Props = Props;
