import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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