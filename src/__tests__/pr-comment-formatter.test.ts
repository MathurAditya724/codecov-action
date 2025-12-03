import { describe, it, expect } from "vitest";
import { PRCommentFormatter } from "../formatters/pr-comment-formatter.js";
import type { AggregatedTestResults } from "../types/test-results.js";

describe("PRCommentFormatter", () => {
	const formatter = new PRCommentFormatter();

	it("should format results with all passing tests", () => {
		const results: AggregatedTestResults = {
			totalTests: 10,
			passedTests: 10,
			failedTests: 0,
			skippedTests: 0,
			totalTime: 5.5,
			passRate: 100,
			failedTestCases: [],
		};

		const comment = formatter.formatComment(results);

		expect(comment).toContain("## Test Results 🧪");
		expect(comment).toContain("✅ **10 passed**");
		expect(comment).toContain("**Total: 10**");
		expect(comment).toContain("**Pass Rate: 100%**");
		expect(comment).toContain("### ✅ All Tests Passed!");
		expect(comment).toContain("5.50s");
	});

	it("should format results with failed tests", () => {
		const results: AggregatedTestResults = {
			totalTests: 5,
			passedTests: 3,
			failedTests: 2,
			skippedTests: 0,
			totalTime: 2.5,
			passRate: 60,
			failedTestCases: [
				{
					suiteName: "Test Suite 1",
					testCase: {
						classname: "test/example.test.ts",
						name: "should fail test 1",
						time: 0.5,
						failure: {
							message: "Expected 5 to equal 6",
							type: "AssertionError",
							content: "Error: Expected 5 to equal 6\n    at Object.toBe",
						},
					},
				},
				{
					suiteName: "Test Suite 2",
					testCase: {
						classname: "test/another.test.ts",
						name: "should fail test 2",
						time: 0.3,
						failure: {
							message: "Timeout exceeded",
						},
					},
				},
			],
		};

		const comment = formatter.formatComment(results);

		expect(comment).toContain("## Test Results 🧪");
		expect(comment).toContain("✅ **3 passed**");
		expect(comment).toContain("❌ **2 failed**");
		expect(comment).toContain("**Pass Rate: 60%**");
		expect(comment).toContain("### ❌ Failed Tests");
		expect(comment).toContain("`should fail test 1`");
		expect(comment).toContain("**File:** `test/example.test.ts`");
		expect(comment).toContain("**Error:** Expected 5 to equal 6");
		expect(comment).toContain("<details>");
		expect(comment).toContain("<summary>Stack Trace</summary>");
		expect(comment).toContain("at Object.toBe");
		expect(comment).toContain("`should fail test 2`");
		expect(comment).toContain("**Error:** Timeout exceeded");
	});

	it("should format results with skipped tests", () => {
		const results: AggregatedTestResults = {
			totalTests: 8,
			passedTests: 5,
			failedTests: 1,
			skippedTests: 2,
			totalTime: 3.2,
			passRate: 62.5,
			failedTestCases: [
				{
					suiteName: "Test Suite",
					testCase: {
						classname: "test/example.test.ts",
						name: "failing test",
						time: 0.5,
						failure: {
							message: "Test failed",
						},
					},
				},
			],
		};

		const comment = formatter.formatComment(results);

		expect(comment).toContain("✅ **5 passed**");
		expect(comment).toContain("❌ **1 failed**");
		expect(comment).toContain("⏭️ **2 skipped**");
		expect(comment).toContain("**Total: 8**");
		expect(comment).toContain("**Pass Rate: 62.5%**");
	});

	it("should format execution time correctly for different durations", () => {
		// Less than 1 second (milliseconds)
		let results: AggregatedTestResults = {
			totalTests: 1,
			passedTests: 1,
			failedTests: 0,
			skippedTests: 0,
			totalTime: 0.234,
			passRate: 100,
			failedTestCases: [],
		};

		let comment = formatter.formatComment(results);
		expect(comment).toContain("234ms");

		// Seconds
		results = {
			...results,
			totalTime: 5.67,
		};
		comment = formatter.formatComment(results);
		expect(comment).toContain("5.67s");

		// Minutes and seconds
		results = {
			...results,
			totalTime: 125.4,
		};
		comment = formatter.formatComment(results);
		expect(comment).toContain("2m 5s");
	});

	it("should add identifier to comment", () => {
		const comment = "Test comment";
		const withIdentifier = formatter.addIdentifier(comment);

		expect(withIdentifier).toContain(
			PRCommentFormatter.getCommentIdentifier(),
		);
		expect(withIdentifier).toContain("Test comment");
	});

	it("should handle tests with no stack trace", () => {
		const results: AggregatedTestResults = {
			totalTests: 1,
			passedTests: 0,
			failedTests: 1,
			skippedTests: 0,
			totalTime: 0.5,
			passRate: 0,
			failedTestCases: [
				{
					suiteName: "Test Suite",
					testCase: {
						classname: "test/example.test.ts",
						name: "test without stack trace",
						time: 0.5,
						failure: {
							message: "Simple failure",
						},
					},
				},
			],
		};

		const comment = formatter.formatComment(results);

		expect(comment).toContain("**Error:** Simple failure");
		// Should not have details section for stack trace
		expect(comment.split("<details>").length - 1).toBe(0);
	});
});

