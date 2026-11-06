# k.router: Routes
status: proposed

**Manifest.** `routes.ts` exports `routes = manifest({ 'orders.show': { path: '/orders/:id', params: s.object({ id: s.id('Order') }), search: s.object({ tab: s.enum(['items','history']).optional() }), loader, actions: { POST: updateOrder }, layout: 'app', guard: 'auth' } })`.

**Links.** `href('orders.show', { id }, { tab })` typed; string paths in `<a href>` are E1501.

**Navigation.** Scroll restoration and focus to main on navigate; `<Form method="POST" action="orders.show">` submits to the action and revalidates loaders.

**Conformance.** Every route reachable from manifest; params parse or 404; search parse or default; guard denial redirects; loader errors reach the route's error slot.
