import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/content-script.ts"),
            name: "ContentScript",
            fileName: "content-script",
            formats: ["iife"],
        },
        rollupOptions: {
            output: {
                extend: true,
                entryFileNames: "content-script.js",
            },
        },
        emptyOutDir: false,
        outDir: "dist",
    },
});
