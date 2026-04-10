import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // @xxt-agent/types 直接引用 packages/types/src
      "@xxt-agent/types": resolve(__dirname, "../../packages/types/src"),
    },
  },
  server: {
    port: 5173,
    // 開發時 WebSocket 連 Gateway（後端走代理避免 CORS）
    proxy: {
      "/ws": {
        target: process.env["VITE_GATEWAY_URL"] ?? "ws://localhost:3100",
        ws: true,
        changeOrigin: true,
      },
      "/api": {
        target: process.env["VITE_GATEWAY_URL"] ?? "http://localhost:3100",
        changeOrigin: true,
      },
    },
  },
  define: {
    // 讓 TypeScript 能讀到 env（build time 注入）
    __GATEWAY_URL__: JSON.stringify(
      process.env["VITE_GATEWAY_URL"] ?? "ws://localhost:3100",
    ),
  },
});
