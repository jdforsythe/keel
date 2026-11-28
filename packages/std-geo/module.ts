import { module } from "@keel/compiler";

/** The `@keel/std-geo` library manifest (std.geo, k.library): a module that reads the device position lists the package in `deps`. */
export default module({
  id: "geo",
  deps: [],
  capabilities: [],
  public: {
    exports: ["geo", "Geolocator", "Position"],
  },
});
