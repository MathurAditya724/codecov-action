import * as glob from "@actions/glob";
import * as core from "@actions/core";

export class FileFinder {
	/**
	 * Find files matching the given glob pattern
	 * @param pattern Glob pattern to match files
	 * @returns Array of file paths matching the pattern
	 */
	async findFiles(pattern: string): Promise<string[]> {
		try {
			core.info(`Searching for files matching pattern: ${pattern}`);

			const globber = await glob.create(pattern, {
				followSymbolicLinks: false,
			});

			const files = await globber.glob();

			if (files.length === 0) {
				core.warning(`No files found matching pattern: ${pattern}`);
				return [];
			}

			core.info(`Found ${files.length} file(s) matching pattern`);
			for (const file of files) {
				core.info(`  - ${file}`);
			}

			return files;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error";
			core.error(`Error finding files with pattern '${pattern}': ${message}`);
			throw new Error(`Failed to find files: ${message}`);
		}
	}

	/**
	 * Validate that files exist and are readable
	 * @param files Array of file paths to validate
	 * @returns Array of valid file paths
	 */
	validateFiles(files: string[]): string[] {
		const validFiles: string[] = [];

		for (const file of files) {
			try {
				// Check if file exists and is readable by attempting to access it
				const fs = require("node:fs");
				fs.accessSync(file, fs.constants.R_OK);
				validFiles.push(file);
			} catch (error) {
				core.warning(`File not readable or does not exist: ${file}`);
			}
		}

		return validFiles;
	}
}

