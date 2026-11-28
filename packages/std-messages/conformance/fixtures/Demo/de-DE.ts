import { Demo } from "../Demo.schema.ts";

export default Demo.text({
  title: "Rezepte",
  count: { plural: "n", one: "# Rezept", other: "# Rezepte" },
  kind: { select: "k", cases: { a: "Art A", b: "Art B" } },
});
