import { Demo } from "../Demo.schema.ts";

export default Demo.text({
  title: "Recipes",
  count: { plural: "n", one: "# recipe", other: "# recipes" },
  kind: { select: "k", cases: { a: "Kind A", b: "Kind B" } },
});
