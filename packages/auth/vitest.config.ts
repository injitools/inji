import {defineConfig} from "vitest/config";
import swc from "unplugin-swc";

import {swcAuthOptions} from "./tests/swc-options.js";

// The SWC plugin emits TypeORM decorator metadata (see swc-options). The tests use an
// in-memory fake EntityManager (no real DB driver) — portable to CI.
export default defineConfig({
    plugins: [swc.vite(swcAuthOptions)],
    test: {
        include: ["tests/**/*.test.ts"],
        typecheck: {
            enabled: true,
            tsconfig: "./tests/tsconfig.typecheck.json",
            include: ["tests/**/*.test-d.ts"],
        },
    },
});
