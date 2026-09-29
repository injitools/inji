import {defineConfig} from "vitest/config";

// The provider is tested against an in-memory storage and a stubbed VK client — no network, no DB.
export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
    },
});
