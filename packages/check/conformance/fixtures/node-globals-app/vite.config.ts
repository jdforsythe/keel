/** A tool config: it reads `process.env` and is no browser file. */
export default { define: { __MODE__: JSON.stringify(process.env.NODE_ENV) } };
