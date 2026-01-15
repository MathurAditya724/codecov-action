import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import * as yaml from "js-yaml";
import type { CodecovConfig, NormalizedConfig } from "../types/config.js";

export class ConfigLoader {
  /**
   * Load and parse configuration from .github/coverage.yml or .github/codecov.yml
   */
  async loadConfig(): Promise<NormalizedConfig> {
    const configPath = this.findConfigPath();
    let config: CodecovConfig = {};

    if (configPath) {
      core.info(`📝 Loading configuration from ${configPath}`);
      try {
        const fileContent = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContent) as CodecovConfig;
        if (parsed) {
          config = parsed;
        }
      } catch (error) {
        core.warning(
          `Failed to load configuration file: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    } else {
      core.debug("No configuration file found");
    }

    return this.normalizeConfig(config);
  }

  /**
   * Find the configuration file path
   */
  private findConfigPath(): string | null {
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    const candidates = [
      ".github/coverage.yml",
      ".github/coverage.yaml",
      ".github/codecov.yml",
      ".github/codecov.yaml",
      "coverage.yml",
      "codecov.yml",
    ];

    for (const candidate of candidates) {
      const fullPath = path.join(workspace, candidate);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: CodecovConfig): NormalizedConfig {
    const coverage = config.coverage || {};
    const status = coverage.status || {};
    const project = status.project || {};
    const patch = status.patch || {};

    return {
      status: {
        project: {
          target: project.target ?? "auto",
          threshold: project.threshold ?? null,
        },
        patch: {
          target: typeof patch.target === "number" ? patch.target : 80, // Default 80% for patch
          threshold: patch.threshold ?? null,
        },
      },
      ignore: coverage.ignore || [],
    };
  }
}
