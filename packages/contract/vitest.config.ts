import {defineConfig} from "vitest/config";

// Vite 8 transforms TS via rolldown/Oxc, which emits decorator metadata
// (design:type) based on emitDecoratorMetadata from tsconfig.base.json. Therefore a separate
// plugin for running the unit tests is not needed.
export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        testTimeout: 60_000,
        // Type-level Infer/InferInput tests (acceptance criterion #2) — verified by tsc in a
        // strict config. The *.test-d.ts files do not overlap with the runtime include above.
        typecheck: {
            enabled: true,
            tsconfig: "./tests/tsconfig.typecheck.json",
            include: ["tests/**/*.test-d.ts"],
        },
    },
});
