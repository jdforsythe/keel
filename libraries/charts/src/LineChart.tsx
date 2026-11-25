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
 * A line through the values in order, a dot on each when there are 32 or fewer, the first and last `name` below
 * and their `shown` beside them. The drawing is one picture, `<id>.chart`, named by `label` and described by the
 * `summary` line beside it, `<id>.summary`; `<id>.button` opens the same values as a table.
 */
export default function LineChart(props: Infer<typeof Props> & { readonly styles?: ChartStyles }) {
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
        code={() => import("./lineCode.ts").then((m) => m.lineCode)}
      />
      <Text {...props.styles?.summary} id={`${props.id}.summary`}>
        {props.summary}
      </Text>
      <ChartNumbers id={props.id} label={props.label} points={props.points} text={props.text} styles={props.styles} />
    </Box>
  );
}
