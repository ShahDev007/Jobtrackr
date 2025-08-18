import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Make sure React is loaded from a single place in monorepos
    dedupe: ["react", "react-dom"],
  },
});
