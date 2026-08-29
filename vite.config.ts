/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localApiPlugin } from "./scripts/vite-api-plugin";

// Local Vercel-compatible API handlers read server-only values from process.env.
// Vite otherwise exposes loaded values only through import.meta.env, so mirror
// the complete local environment before the first API module is imported.
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [react(), localApiPlugin()],
    build: {
      outDir: "dist",
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}", "api/**/*.{test,spec}.ts"],
      passWithNoTests: true,
      testTimeout: 20000,
    },
  };
});