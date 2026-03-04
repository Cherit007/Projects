import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
  base: command === "build" ? "/Projects/" : "/",
    plugins: [react(), tailwindcss(), createPwaSwBuildIdPlugin()],
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.js",
      exclude: [
        "e2e/**",
        "node_modules/**",
        "dist/**",
        "docs/**",
      ],
    },
    build: {
    outDir: "docs",
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
