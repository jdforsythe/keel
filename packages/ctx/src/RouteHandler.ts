/** Handler for a simulated net route. */
export type RouteHandler = (req: Request) => Response | Promise<Response>;
