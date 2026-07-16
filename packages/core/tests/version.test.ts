import {test, expect} from "vitest";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {VERSION} from "../src/version.js";

const testsDir = path.dirname(fileURLToPath(import.meta.url));

// VERSION is what sharedSingleton compares between duplicated copies of the framework. If it drifted
// away from package.json, two genuinely different copies could claim to be the same version and
// silently share a registry whose shape they disagree on.
test("VERSION matches package.json", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(testsDir, "../package.json"), "utf8"));
    expect(VERSION).toBe(pkg.version);
});
