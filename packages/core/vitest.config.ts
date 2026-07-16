import {defineConfig} from "vitest/config";

// Vite 8 (rolldown/Oxc) emits decorator metadata (design:type/paramtypes) from
// emitDecoratorMetadata in tsconfig.base.json — so unit/integration tests need no extra plugin.
export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        // A programmatic Vite build of the fixture + spinning up a real HTTP server need headroom.
        testTimeout: 60_000,
        // Type-level tests for RouterClient<R> — checked by tsc in a strict config.
        // The *.test-d.ts files do not overlap with the runtime include above.
        typecheck: {
            enabled: true,
            tsconfig: "./tests/tsconfig.typecheck.json",
            include: ["tests/**/*.test-d.ts"],
        },
    },
});
