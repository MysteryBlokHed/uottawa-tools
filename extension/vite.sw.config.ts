import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/browser/service-worker.ts"),
            name: "ContentScript",
            fileName: "service-worker",
            formats: ["iife"],
        },
        rollupOptions: {
            output: {
                extend: true,
                entryFileNames: "service-worker.js",
            },
        },
        emptyOutDir: false,
        outDir: "dist",
    },
});
