import {defineConfig} from "vitest/config";
import swc from "unplugin-swc";

import {swcBotOptions} from "./tests/swc-options.js";

// The SWC plugin emits TypeORM decorator metadata (see swc-options). The tests use an
// in-memory fake EntityManager (no real DB driver) — portable to CI.
export default defineConfig({
    plugins: [swc.vite(swcBotOptions)],
    test: {
        include: ["tests/**/*.test.ts"],
    },
});
