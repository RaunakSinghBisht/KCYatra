import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import viteTsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [viteTsconfigPaths()],
  nitro: { preset: "node-server" },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
