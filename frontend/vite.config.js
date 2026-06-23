import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: [
      { find: "@food/components", replacement: path.resolve(__dirname, "./src/components") },
      { find: "@food/api/config", replacement: path.resolve(__dirname, "./src/lib/api/config.js") },
      { find: "@food/api/axios", replacement: path.resolve(__dirname, "./src/lib/api/axios.js") },
      { find: "@food/api", replacement: path.resolve(__dirname, "./src/lib/api/index.js") },
      { find: "@food", replacement: path.resolve(__dirname, "./src/module/delivery") },
      { find: "@delivery", replacement: path.resolve(__dirname, "./src/module/deliveryV2") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: ["react", "react-dom"],
  },

  optimizeDeps: {
    include: [
      "@emotion/react",
      "@emotion/styled",
      "@mui/material",
      "@mui/icons-material",
      "@mui/x-date-pickers",
    ],
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
  },

  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
    minify: "esbuild",
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
  },
});
