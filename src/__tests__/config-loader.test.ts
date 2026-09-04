import * as fs from "node:fs";
import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigLoader } from "../config/config-loader.js";

vi.mock("node:fs");
vi.mock("@actions/core", () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

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
    expect(config.status.project.informational).toBe(false);
    expect(config.status.patch.target).toBe(80);
    expect(config.status.patch.informational).toBe(false);
    expect(config.ignore).toEqual([]);
    expect(config.comment.enabled).toBe(false);
    expect(config.config.files).toBe("changed");
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

  describe("informational flag", () => {
    it("should parse informational: true for project", async () => {
      const yaml = `
coverage:
  status:
    project:
      target: 80
      informational: true
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.status.project.informational).toBe(true);
      expect(config.status.patch.informational).toBe(false);
    });

    it("should parse informational: true for patch", async () => {
      const yaml = `
coverage:
  status:
    patch:
      target: 70
      informational: true
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.status.project.informational).toBe(false);
      expect(config.status.patch.informational).toBe(true);
    });
  });

  describe("nested default key (Codecov-style)", () => {
    it("should parse project.default.target", async () => {
      const yaml = `
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 10
        informational: true
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.status.project.target).toBe("auto");
      expect(config.status.project.threshold).toBe(10);
      expect(config.status.project.informational).toBe(true);
    });

    it("should parse patch.default.target", async () => {
      const yaml = `
coverage:
  status:
    patch:
      default:
        target: 90
        informational: true
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.status.patch.target).toBe(90);
      expect(config.status.patch.informational).toBe(true);
    });
  });

  describe("threshold parsing", () => {
    it("should parse threshold as percentage string", async () => {
      const yaml = `
coverage:
  status:
    project:
      target: auto
      threshold: "10%"
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.status.project.threshold).toBe(10);
    });

    it("should parse threshold as number string without percent sign", async () => {
      const yaml = `
coverage:
  status:
    project:
      target: auto
      threshold: "5"
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.status.project.threshold).toBe(5);
    });

    it("should parse threshold as decimal percentage string", async () => {
      const yaml = `
coverage:
  status:
    project:
      target: auto
      threshold: "2.5%"
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.status.project.threshold).toBe(2.5);
    });

    it("should parse threshold as number", async () => {
      const yaml = `
coverage:
  status:
    project:
      target: auto
      threshold: 3
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.status.project.threshold).toBe(3);
    });
  });

  describe("comment configuration", () => {
    it("should parse comment: true", async () => {
      const yaml = `
comment: true
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.comment.enabled).toBe(true);
    });

    it("should parse comment: false", async () => {
      const yaml = `
comment: false
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.comment.enabled).toBe(false);
    });

    it("should handle comment: null without crashing", async () => {
      const yaml = `
comment: null
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.comment.enabled).toBe(true);
    });

    it("should default comment to disabled when not specified", async () => {
      const yaml = `
coverage:
  status:
    project:
      target: 80
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.comment.enabled).toBe(false);
    });
  });

  describe("config section", () => {
    it("should default config.files to changed when not specified", async () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(false);

      const config = await loader.loadConfig();

      expect(config.config.files).toBe("changed");
    });

    it("should parse config.files changed", async () => {
      const yaml = `
config:
  files: changed
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.config.files).toBe("changed");
    });

    it("should parse config.files none", async () => {
      const yaml = `
config:
  files: none
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.config.files).toBe("none");
    });

    it("should parse config.files all", async () => {
      const yaml = `
config:
  files: all
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);

      const config = await loader.loadConfig();

      expect(config.config.files).toBe("all");
    });

    it("should fallback to changed for invalid config.files value", async () => {
      const yaml = `
config:
  files: bad
`;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(yaml);
      const warningSpy = vi.mocked(core.warning);

      const config = await loader.loadConfig();

      expect(config.config.files).toBe("changed");
      expect(warningSpy).toHaveBeenCalledWith(
        'Invalid config.files value "bad". Falling back to "changed". Valid values: all, changed, none.',
      );
    });
  });
});
