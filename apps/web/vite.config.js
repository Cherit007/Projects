import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(projectRoot, "../..");

const createPwaSwBuildIdPlugin = () => {
  const buildId = (
    process.env.VITE_BUILD_ID
    || process.env.GITHUB_SHA
    || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  return {
    name: "pwa-sw-build-id",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "sw-build-id.js",
        source: `self.__SW_BUILD_ID__ = ${JSON.stringify(buildId)};\n`,
      });
    },
  };
};

export default defineConfig(({ command }) => ({
  root: projectRoot,
  envDir: repoRoot,
  base: command === "build" ? "/Projects/" : "/",
  resolve: {
    alias: {
      "@fixture-maker/domain": path.resolve(repoRoot, "packages/domain/src"),
      "@fixture-maker/config": path.resolve(repoRoot, "packages/config/src"),
      "@fixture-maker/api": path.resolve(repoRoot, "packages/api/src"),
      "@fixture-maker/types": path.resolve(repoRoot, "packages/types/src"),
      "@fixture-maker/storage": path.resolve(repoRoot, "packages/storage/src"),
      "@fixture-maker/analytics": path.resolve(repoRoot, "packages/analytics/src"),
    },
  },
  plugins: [react(), tailwindcss(), createPwaSwBuildIdPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    exclude: [
      "e2e/**",
      "node_modules/**",
      "dist/**",
      "../../docs/**",
    ],
  },
  build: {
    outDir: path.resolve(repoRoot, "docs"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("/appwrite/")) return "vendor-appwrite";
          if (id.includes("lucide-react")) return "vendor-icons";
          return undefined;
        },
      },
    },
  },
}));
