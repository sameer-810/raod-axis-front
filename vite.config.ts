import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5175,
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * The map library is ~150 kB and is needed by exactly one view, which is
         * not the one a driver lands on. Splitting it keeps it off the critical
         * path of the first screen — the one measured against "interactive
         * within 2.5s on 4G" in PRD §5.
         */
        manualChunks: {
          map: ["leaflet", "react-leaflet"],
          charts: ["recharts"],
        },
      },
    },
  },
});
