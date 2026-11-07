/**
 * Where a node deployable's client build records its files (k.server Build, RFC 0048), relative to the build directory
 * `dist/<deployable>`: Vite's manifest, whose entry chunk is the bundled resume entry. The Vite plugin writes it under
 * `keel build`; a production `createApp({ assets })` reads it at startup.
 */
export const CLIENT_MANIFEST = ".vite/manifest.json";
