# Accessibility target

WCAG 2.2 AA, enforced structurally: base elements require labels at the type level (`Box` as `nav` or `aside` requires `label`); headless primitives ship keyboard and focus behavior; contrast computed from tokens at build; motion honors reduced-motion; tests assert on the a11y tree. `keel check` is static; `@keel/testing` `render` runs five structural rules (`image-alt`, `button-name`, `link-name`, `label`, `landmark-unique`) and compares roles and names with `a11y.json` (E1702, E1703).

verified: 40e24cec12b6c28e2fd5d39fda9ba0560e83e889
