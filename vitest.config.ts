import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["junit"],
    outputFile: {
      junit: "report.junit.xml",
    },
    coverage: {
      include: ["src/__tests__/**/*.ts"],
    },
  },
});
