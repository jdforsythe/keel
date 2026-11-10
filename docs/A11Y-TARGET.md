# Accessibility target

WCAG 2.2 AA, enforced structurally: base elements require labels at the type level; headless primitives ship keyboard and focus behavior; contrast computed from tokens at build; motion honors reduced-motion; tests assert on the a11y tree. `keel check` is static (RFC 0023); `@keel/testing` `render` runs axe-core rules on rendered output (E1702, E1703).

verified: 30a5850cfed9146e5cd4d7f6a4c58ba5551b2794
