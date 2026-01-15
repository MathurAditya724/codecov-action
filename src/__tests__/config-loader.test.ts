import * as fs from "node:fs";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ConfigLoader } from "../config/config-loader.js";

vi.mock("node:fs");

describe("ConfigLoader", () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    loader = new ConfigLoader();
    vi.resetAllMocks();
  });

  it("should return defaults when no config file found", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    
    const config = await loader.loadConfig();
    
    expect(config.status.project.target).toBe("auto");
    expect(config.status.project.threshold).toBeNull();
    expect(config.status.patch.target).toBe(80);
    expect(config.ignore).toEqual([]);
  });

  it("should parse valid yaml config", async () => {
    const yaml = `
coverage:
  status:
    project:
      target: 90
      threshold: 1
    patch:
      target: 100
  ignore:
    - "test/**"
`;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

    const config = await loader.loadConfig();

    expect(config.status.project.target).toBe(90);
    expect(config.status.project.threshold).toBe(1);
    expect(config.status.patch.target).toBe(100);
    expect(config.ignore).toEqual(["test/**"]);
  });

  it("should handle partial config with defaults", async () => {
    const yaml = `
coverage:
  status:
    project:
      target: 85
`;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

    const config = await loader.loadConfig();

    expect(config.status.project.target).toBe(85);
    expect(config.status.patch.target).toBe(80); // Default preserved
  });
});
