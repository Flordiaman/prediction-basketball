import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // keeps existing behavior (polymarket still uses /api)
      "/api": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        // existing main app (DO NOT BREAK)
        main: resolve(__dirname, "index.html"),
        // new NBA page
        nba: resolve(__dirname, "nba.html"),
      },
    },
  },
});


