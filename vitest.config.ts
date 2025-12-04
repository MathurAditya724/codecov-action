import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["default", "junit"],
    outputFile: {
      junit: "report.junit.xml",
    },
    coverage: {
      include: ["src/**/*.ts"],
    },
  },
});
