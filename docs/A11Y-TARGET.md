# Accessibility target

WCAG 2.2 AA, enforced structurally: base elements require labels at the type level; headless primitives ship keyboard and focus behavior; contrast computed from tokens at build; motion honors reduced-motion; tests assert on the a11y tree. `keel check` is static (RFC 0023); `@keel/testing` `render` runs axe-core rules on rendered output (E1702, E1703).

verified: 959a568f16e924fac59329e75c1585fe38d4c00e
