import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src/webview",
  build: {
    outDir: "../../dist/webview",
    emptyOutDir: true,
    // Disable modulepreload polyfill — not needed in VS Code webview
    modulePreload: false,
    rollupOptions: {
      input: path.resolve(__dirname, "src/webview/index.html"),
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/webview"),
    },
  },
});
