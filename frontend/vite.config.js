import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: "@food/api", replacement: fileURLToPath(new URL("./src/lib/api/index.js", import.meta.url)) },
      { find: "@food/api/config", replacement: fileURLToPath(new URL("./src/lib/api/config.js", import.meta.url)) },
      { find: "@food/api/axios", replacement: fileURLToPath(new URL("./src/lib/api/axios.js", import.meta.url)) },
    ],
  },
});
