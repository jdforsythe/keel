# Accessibility target

WCAG 2.2 AA, enforced structurally: base elements require labels at the type level (`Box` as `nav` or `aside` requires `label`); headless primitives ship keyboard and focus behavior (`@keel/std-headless` widgets follow the WAI-ARIA Authoring Practices 1.2 patterns, std.headless and std.options state each key, and a closed dialog returns focus to the element focused before it); contrast computed from tokens at build; motion honors reduced-motion; tests assert on the a11y tree. `keel check` is static; `@keel/testing` `render` runs axe-core's WCAG 2.2 A and AA rules plus `landmark-unique`, checks contrast from the tokens, and compares roles and names with `a11y.json` (E1702, E1703).

verified: c182f5aa03455668536e03fa5582755933602725
