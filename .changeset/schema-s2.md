---
"@keel/schema": minor
---

s.format(name, base, { check, gen: { from, map } }) narrows a schema by a pure predicate and brands its type Format<T, name>. parse runs base, then check (a throw is false); a refusal is the new rule `format`. encode and decodeStrings are base's, doc() is the name, gen maps gen(from) through map. The node is { kind: "format", name, base }; check and gen stay in memory, and JSON.stringify(schema) writes the node. s.enum(values, { pathDefault }) records the default of a leading path param (parse, encode and gen ignore it) and throws when it is not one of the values.
