import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {fileURLToPath, URL} from "node:url";

// Admin panel built on React + shadcn/ui (Tailwind v4).
// API types come from generated interfaces (src/api/schema.gen.ts); the client is fetch (src/api.ts).
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {"@": fileURLToPath(new URL("./src", import.meta.url))},
    },
    server: {port: 5174},
});
