import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
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
      "@mui/x-date-pickers",
      "mapbox-gl",
      "react-map-gl",
    ],
  },
  server: {
    host: "0.0.0.0", // Allow access from network
    port: 5173, // Default Vite port
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    minify: "esbuild",
    target: "es2020",
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("@mui") || id.includes("emotion")) return "vendor-mui";
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) return "vendor-react";
            if (id.includes("mapbox") || id.includes("leaflet") || id.includes("turf")) return "vendor-maps";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("framer-motion") || id.includes("motion/")) return "vendor-motion";
          }
          return null;
        },
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
