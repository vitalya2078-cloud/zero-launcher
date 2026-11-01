import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// base: './' — чтобы сборка работала из подпапки GitHub Pages
export default defineConfig({
  base: "./",
  plugins: [preact()],
  build: { target: "es2020", chunkSizeWarningLimit: 600 },
});
