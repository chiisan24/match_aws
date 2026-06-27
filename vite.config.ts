/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vercel build output: default "dist" directory (static SPA).
// AWS connection info is read at runtime via import.meta.env (see src/config/env.ts).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // No tests exist yet (test tasks are optional); don't fail the runner.
    passWithNoTests: true,
    // Property-based tests (fast-check) run a high number of iterations.
    testTimeout: 20000,
  },
});
