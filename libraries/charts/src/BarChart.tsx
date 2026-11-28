import { type Infer, s } from "@keel/schema";
import { Box, Host, Text } from "@keel/ui";
import ChartNumbers from "./ChartNumbers.tsx";
import type { ChartStyles } from "./ChartStyles.ts";
import { ChartText } from "./ChartText.schema.ts";
import { Point } from "./Point.schema.ts";
import { Series } from "./Series.schema.ts";

export const Props = s.object({
  id: s.string(),
  label: s.string({ min: 1 }),
  summary: s.string({ min: 1 }),
  points: s.array(Point),
  text: ChartText,
});

/**
 * A bar per value, rising from a zero line (a negative value hangs below it), each bar's `shown` above it and its
 * `name` below. The drawing is one picture, `<id>.chart`, named by `label` and described by the `summary` line beside
 * it, `<id>.summary`; `<id>.button` opens the same values as a table.
 */
export default function BarChart(props: Infer<typeof Props> & { readonly styles?: ChartStyles }) {
  return (
    <Box id={props.id}>
      <Host
        {...props.styles?.chart}
        id={`${props.id}.chart`}
        role="img"
        label={props.label}
        describedBy={`${props.id}.summary`}
        input={Series}
        value={{ points: props.points }}
        code={() => import("./barsCode.ts").then((m) => m.barsCode)}
      />
      <Text {...props.styles?.summary} id={`${props.id}.summary`}>
        {props.summary}
      </Text>
      <ChartNumbers id={props.id} label={props.label} points={props.points} text={props.text} styles={props.styles} />
    </Box>
  );
}
