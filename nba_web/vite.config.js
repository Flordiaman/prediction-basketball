import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "/nba/",                 // IMPORTANT: assets load under /nba/...
  build: {
    outDir: resolve(__dirname, "../src/nba_public"),
    emptyOutDir: true
  },
  server: {
    port: 5178,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true
      }
    }
  }
});
