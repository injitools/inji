import {defineConfig} from "vitest/config";

// No decorators here: the provider is tested against an in-memory storage and a stubbed Bot API
// client — no network, no DB.
export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
    },
});
