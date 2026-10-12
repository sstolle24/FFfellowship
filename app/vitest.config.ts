import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["supabase/tests/**/*.test.ts", "src/**/*.test.ts"], sequence: { concurrent: false }, fileParallelism: false },
});
