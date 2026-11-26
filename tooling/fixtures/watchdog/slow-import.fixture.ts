import { it } from "vitest";
import "./slow-module.ts";

it("passes after a slow import", () => {});
