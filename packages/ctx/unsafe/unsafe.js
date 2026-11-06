export function unsafe(reason, fn) {
    if (reason.length === 0)
        throw new Error("unsafe requires a justification");
    return fn();
}
