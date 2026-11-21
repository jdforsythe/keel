import { s } from "@keel/schema";
import { Bars } from "./Bars.schema.ts";

export const Home = s.object({ heading: s.string(), chart: s.string(), rain: Bars });
