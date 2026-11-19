import { keelConfig } from "../../vitest-config.ts";

export default keelConfig({
  test: { include: ["*.fixture.ts"] },
});
