import { BarChart, LineChart, Sparkline } from "../src/index.ts";

const text = { numbers: "Show the numbers", name: "Day", value: "Spend" };
const points = [{ name: "Mon", value: 1, shown: "1" }];

// @ts-expect-error a chart with no label has no text alternative
BarChart({ id: "c", summary: "s", points, text });
// @ts-expect-error a value is a number, never a string the chart would have to read
LineChart({ id: "c", label: "l", summary: "s", points: [{ name: "Mon", value: "1", shown: "1" }], text });
// @ts-expect-error a point carries how a person reads it: shown is required
Sparkline({ id: "c", label: "l", summary: "s", points: [{ name: "Mon", value: 1 }], text });
// @ts-expect-error a style prop names a token, never a colour literal
BarChart({ id: "c", label: "l", summary: "s", points, text, styles: { chart: { fg: "#ff0000" } } });
