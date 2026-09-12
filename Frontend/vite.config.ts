import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import viteTsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [viteTsconfigPaths()],
});
