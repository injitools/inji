// The package version, as seen at runtime. Used to detect a second, different copy of the
// framework in the same process (see sharedSingleton in @injitools/contract).
// tests/version.test.ts keeps this constant from drifting away from package.json.
export const VERSION = "0.2.1";
