// The package version, as seen at runtime. Used to detect a second, different copy of the
// framework in the same process (see sharedSingleton). It cannot be read from package.json here:
// this package is not allowed to import node builtins (tests/graph.test.ts).
// tests/version.test.ts keeps this constant from drifting away from package.json.
export const VERSION = "0.2.1";
