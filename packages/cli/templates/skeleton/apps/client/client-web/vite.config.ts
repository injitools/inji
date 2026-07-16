import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {fileURLToPath, URL} from "node:url";

// Client-facing frontend on React + shadcn/ui (Tailwind v4).
// API types come from the generated interfaces (src/api/schema.gen.ts); the client is fetch (src/api.ts).
// No runtime dependency on the API packages.
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {"@": fileURLToPath(new URL("./src", import.meta.url))},
    },
    server: {port: 5173},
});
