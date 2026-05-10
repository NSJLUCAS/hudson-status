import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
  plugins: [tailwindcss(), react()],
  optimizeDeps: {
    include: ['d3-geo', 'topojson-client'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // 使用官方 UMD 构建，避免源码 ESM 在 Rollup 中与 path/string 等 class 分包后出现「is not a constructor」
      "d3-geo": path.resolve(__dirname, "./node_modules/d3-geo/dist/d3-geo.js"),
    },
  },
}));
