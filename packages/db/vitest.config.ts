import {defineConfig} from "vitest/config";

// Vite 8 (rolldown/Oxc) emits decorator metadata (design:type/paramtypes) from
// emitDecoratorMetadata in tsconfig.base.json — so the decorator-based tests need no extra plugin.
export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
    },
});
