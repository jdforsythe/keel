/**
 * The name of the constraint each `postgres.constraint` this process made broke (a not-null violation's column), held
 * beside the error and never in its `data`: `constraintOf` hands it out only as a member of a list the app wrote.
 */
export const constraintNames: WeakMap<object, string> = new WeakMap();
