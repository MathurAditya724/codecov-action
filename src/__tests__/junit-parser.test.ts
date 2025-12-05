import { describe, expect, it } from "vitest";
import { JUnitParser } from "../parsers/junit-parser.js";

describe("JUnitParser", () => {
  const parser = new JUnitParser();

  describe("parseXML", () => {
    it("should parse a simple JUnit XML with passing tests", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <testsuites name="jest tests" tests="2" failures="0" errors="0" time="1.007">
      <testsuite name="Example Suite" errors="0" failures="0" skipped="0" timestamp="2024-02-22T19:10:35" time="0.955" tests="2">
        <testcase classname="test/example.test.ts" name="test one" time="0.4"></testcase>
        <testcase classname="test/example.test.ts" name="test two" time="0.5"></testcase>
      </testsuite>
    </testsuites>`;

      const result = parser.parseXML(xml);

      expect(result.tests).toBe(2);
      expect(result.failures).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.testsuites).toHaveLength(1);
      expect(result.testsuites[0].testcases).toHaveLength(2);
      expect(result.testsuites[0].testcases[0].name).toBe("test one");
    });

    it("should parse JUnit XML with failing tests", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="jest tests" tests="2" failures="1" errors="0" time="1.007">
  <testsuite name="Example Suite" errors="0" failures="1" skipped="0" timestamp="2024-02-22T19:10:35" time="0.955" tests="2">
    <testcase classname="test/example.test.ts" name="test passing" time="0.4"></testcase>
    <testcase classname="test/example.test.ts" name="test failing" time="0.5">
      <failure message="Expected 5 to equal 6" type="AssertionError">
Error: Expected 5 to equal 6
    at Object.toBe (test/example.test.ts:10:20)
      </failure>
    </testcase>
  </testsuite>
</testsuites>`;

      const result = parser.parseXML(xml);

      expect(result.tests).toBe(2);
      expect(result.failures).toBe(1);
      expect(result.testsuites[0].testcases).toHaveLength(2);

      const failedTest = result.testsuites[0].testcases[1];
      expect(failedTest.name).toBe("test failing");
      expect(failedTest.failure).toBeDefined();
      expect(failedTest.failure?.message).toBe("Expected 5 to equal 6");
      expect(failedTest.failure?.type).toBe("AssertionError");
      expect(failedTest.failure?.content).toContain("at Object.toBe");
    });

    it("should parse JUnit XML with skipped tests", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="jest tests" tests="2" failures="0" errors="0" time="1.007">
  <testsuite name="Example Suite" errors="0" failures="0" skipped="1" timestamp="2024-02-22T19:10:35" time="0.955" tests="2">
    <testcase classname="test/example.test.ts" name="test passing" time="0.4"></testcase>
    <testcase classname="test/example.test.ts" name="test skipped" time="0">
      <skipped />
    </testcase>
  </testsuite>
</testsuites>`;

      const result = parser.parseXML(xml);

      expect(result.tests).toBe(2);
      expect(result.testsuites[0].skipped).toBe(1);
      expect(result.testsuites[0].testcases[1].skipped).toBe(true);
    });

    it("should parse single testsuite without testsuites wrapper", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Example Suite" errors="0" failures="0" skipped="0" tests="1" time="0.5">
  <testcase classname="test/example.test.ts" name="test one" time="0.4"></testcase>
</testsuite>`;

      const result = parser.parseXML(xml);

      expect(result.testsuites).toHaveLength(1);
      expect(result.testsuites[0].name).toBe("Example Suite");
      expect(result.testsuites[0].testcases).toHaveLength(1);
    });

    it("should handle empty test suite", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="jest tests" tests="0" failures="0" errors="0" time="0">
  <testsuite name="Empty Suite" errors="0" failures="0" skipped="0" tests="0" time="0">
  </testsuite>
</testsuites>`;

      const result = parser.parseXML(xml);

      expect(result.tests).toBe(0);
      expect(result.testsuites).toHaveLength(1);
      expect(result.testsuites[0].testcases).toHaveLength(0);
    });

    it("should throw error for invalid XML", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<invalid>Not a JUnit format</invalid>`;

      expect(() => parser.parseXML(xml)).toThrow();
    });
  });

  describe("aggregateResults", () => {
    it("should aggregate multiple test results", () => {
      const results = [
        {
          tests: 5,
          failures: 1,
          errors: 0,
          skipped: 1,
          time: 2.5,
          testsuites: [
            {
              name: "Suite 1",
              tests: 5,
              failures: 1,
              errors: 0,
              skipped: 1,
              time: 2.5,
              testcases: [
                {
                  classname: "test1.ts",
                  name: "test 1",
                  time: 0.5,
                },
                {
                  classname: "test1.ts",
                  name: "test 2",
                  time: 0.5,
                  failure: {
                    message: "Test failed",
                    content: "Stack trace here",
                  },
                },
                {
                  classname: "test1.ts",
                  name: "test 3",
                  time: 0.5,
                },
                {
                  classname: "test1.ts",
                  name: "test 4",
                  time: 0.5,
                },
                {
                  classname: "test1.ts",
                  name: "test 5",
                  time: 0.5,
                  skipped: true,
                },
              ],
            },
          ],
        },
        {
          tests: 3,
          failures: 0,
          errors: 0,
          skipped: 0,
          time: 1.5,
          testsuites: [
            {
              name: "Suite 2",
              tests: 3,
              failures: 0,
              errors: 0,
              skipped: 0,
              time: 1.5,
              testcases: [
                {
                  classname: "test2.ts",
                  name: "test 1",
                  time: 0.5,
                },
                {
                  classname: "test2.ts",
                  name: "test 2",
                  time: 0.5,
                },
                {
                  classname: "test2.ts",
                  name: "test 3",
                  time: 0.5,
                },
              ],
            },
          ],
        },
      ];

      const aggregated = JUnitParser.aggregateResults(results);

      expect(aggregated.totalTests).toBe(8);
      expect(aggregated.passedTests).toBe(6);
      expect(aggregated.failedTests).toBe(1);
      expect(aggregated.skippedTests).toBe(1);
      expect(aggregated.totalTime).toBe(4.0);
      expect(aggregated.passRate).toBe(75);
      expect(aggregated.failedTestCases).toHaveLength(1);
      expect(aggregated.failedTestCases[0].testCase.name).toBe("test 2");
    });

    it("should calculate 100% pass rate for all passing tests", () => {
      const results = [
        {
          tests: 3,
          failures: 0,
          errors: 0,
          skipped: 0,
          time: 1.5,
          testsuites: [
            {
              name: "Suite",
              tests: 3,
              failures: 0,
              errors: 0,
              skipped: 0,
              time: 1.5,
              testcases: [
                { classname: "test.ts", name: "test 1", time: 0.5 },
                { classname: "test.ts", name: "test 2", time: 0.5 },
                { classname: "test.ts", name: "test 3", time: 0.5 },
              ],
            },
          ],
        },
      ];

      const aggregated = JUnitParser.aggregateResults(results);

      expect(aggregated.passRate).toBe(100);
    });

    it("should handle empty results", () => {
      const aggregated = JUnitParser.aggregateResults([]);

      expect(aggregated.totalTests).toBe(0);
      expect(aggregated.passedTests).toBe(0);
      expect(aggregated.failedTests).toBe(0);
      expect(aggregated.skippedTests).toBe(0);
      expect(aggregated.passRate).toBe(0);
    });
  });
});
