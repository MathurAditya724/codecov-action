import { describe, expect, it } from "vitest";
import { CoverageParserFactory } from "../parsers/parser-factory.js";

describe("CoverageParserFactory", () => {
  // Sample content for each format
  const cloverXML = `<?xml version="1.0"?>
<coverage clover="3.2.0">
  <project timestamp="123">
    <metrics statements="10" coveredstatements="5" conditionals="2" coveredconditionals="1" methods="3" coveredmethods="2" elements="15" coveredelements="8"/>
  </project>
</coverage>`;

  const coberturaXML = `<?xml version="1.0"?>
<coverage line-rate="0.5" branch-rate="0.3">
  <packages>
    <package name="pkg">
      <classes>
        <class filename="file.py">
          <lines><line number="1" hits="1"/></lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>`;

  const jacocoXML = `<?xml version="1.0"?>
<report name="test">
  <package name="pkg">
    <sourcefile name="File.java">
      <line nr="1" mi="0" ci="5" mb="0" cb="0"/>
      <counter type="LINE" missed="0" covered="1"/>
      <counter type="BRANCH" missed="0" covered="0"/>
      <counter type="METHOD" missed="0" covered="1"/>
    </sourcefile>
  </package>
  <counter type="LINE" missed="0" covered="1"/>
  <counter type="BRANCH" missed="0" covered="0"/>
  <counter type="METHOD" missed="0" covered="1"/>
</report>`;

  const lcovContent = `SF:/src/file.ts
DA:1,5
DA:2,0
LF:2
LH:1
end_of_record
`;

  const istanbulJSON = JSON.stringify({
    "/src/file.ts": {
      path: "/src/file.ts",
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
      },
      fnMap: {},
      branchMap: {},
      s: { "0": 5 },
      f: {},
      b: {},
    },
  });

  const goCoverage = `mode: set
github.com/user/project/file.go:1.1,3.2 1 1
`;

  describe("detectParser", () => {
    it("should detect Clover format", () => {
      const parser = CoverageParserFactory.detectParser(cloverXML);
      expect(parser?.format).toBe("clover");
    });

    it("should detect Cobertura format", () => {
      const parser = CoverageParserFactory.detectParser(coberturaXML);
      expect(parser?.format).toBe("cobertura");
    });

    it("should detect JaCoCo format", () => {
      const parser = CoverageParserFactory.detectParser(jacocoXML);
      expect(parser?.format).toBe("jacoco");
    });

    it("should detect LCOV format", () => {
      const parser = CoverageParserFactory.detectParser(lcovContent);
      expect(parser?.format).toBe("lcov");
    });

    it("should detect Istanbul format", () => {
      const parser = CoverageParserFactory.detectParser(istanbulJSON);
      expect(parser?.format).toBe("istanbul");
    });

    it("should detect Go format", () => {
      const parser = CoverageParserFactory.detectParser(goCoverage);
      expect(parser?.format).toBe("go");
    });

    it("should use file path hints", () => {
      // LCOV by extension
      const parser1 = CoverageParserFactory.detectParser("", "lcov.info");
      expect(parser1?.format).toBe("lcov");

      // Go by extension
      const parser2 = CoverageParserFactory.detectParser("", "coverage.out");
      expect(parser2?.format).toBe("go");
    });

    it("should return null for unknown format", () => {
      const parser = CoverageParserFactory.detectParser("random content");
      expect(parser).toBeNull();
    });
  });

  describe("detectFormatFromPath", () => {
    it("should detect Clover from path", () => {
      expect(CoverageParserFactory.detectFormatFromPath("clover.xml")).toBe(
        "clover"
      );
      expect(
        CoverageParserFactory.detectFormatFromPath("coverage/clover.xml")
      ).toBe("clover");
    });

    it("should detect Cobertura from path", () => {
      expect(CoverageParserFactory.detectFormatFromPath("cobertura.xml")).toBe(
        "cobertura"
      );
      expect(
        CoverageParserFactory.detectFormatFromPath("cobertura-coverage.xml")
      ).toBe("cobertura");
    });

    it("should detect JaCoCo from path", () => {
      expect(CoverageParserFactory.detectFormatFromPath("jacoco.xml")).toBe(
        "jacoco"
      );
      expect(
        CoverageParserFactory.detectFormatFromPath("build/jacoco/test.xml")
      ).toBe("jacoco");
    });

    it("should detect LCOV from path", () => {
      expect(CoverageParserFactory.detectFormatFromPath("lcov.info")).toBe(
        "lcov"
      );
      expect(
        CoverageParserFactory.detectFormatFromPath("coverage.lcov")
      ).toBe("lcov");
    });

    it("should detect Istanbul from path", () => {
      expect(
        CoverageParserFactory.detectFormatFromPath("coverage-final.json")
      ).toBe("istanbul");
    });

    it("should detect Go from path", () => {
      expect(CoverageParserFactory.detectFormatFromPath("coverage.out")).toBe(
        "go"
      );
      expect(CoverageParserFactory.detectFormatFromPath("cover.out")).toBe(
        "go"
      );
    });

    it("should return null for unknown paths", () => {
      expect(
        CoverageParserFactory.detectFormatFromPath("unknown.txt")
      ).toBeNull();
    });
  });

  describe("getParser", () => {
    it("should return correct parser for each format", () => {
      expect(CoverageParserFactory.getParser("clover").format).toBe("clover");
      expect(CoverageParserFactory.getParser("cobertura").format).toBe(
        "cobertura"
      );
      expect(CoverageParserFactory.getParser("jacoco").format).toBe("jacoco");
      expect(CoverageParserFactory.getParser("lcov").format).toBe("lcov");
      expect(CoverageParserFactory.getParser("istanbul").format).toBe(
        "istanbul"
      );
      expect(CoverageParserFactory.getParser("go").format).toBe("go");
    });

    it("should throw for unknown format", () => {
      expect(() =>
        CoverageParserFactory.getParser("unknown" as never)
      ).toThrow("Unsupported coverage format");
    });
  });

  describe("parseContent", () => {
    it("should parse with auto-detection", async () => {
      const result = await CoverageParserFactory.parseContent(lcovContent);
      expect(result.files).toHaveLength(1);
    });

    it("should parse with explicit format", async () => {
      const result = await CoverageParserFactory.parseContent(
        lcovContent,
        undefined,
        "lcov"
      );
      expect(result.files).toHaveLength(1);
    });

    it("should parse with auto format hint", async () => {
      const result = await CoverageParserFactory.parseContent(
        lcovContent,
        "lcov.info",
        "auto"
      );
      expect(result.files).toHaveLength(1);
    });

    it("should throw for undetectable format", async () => {
      await expect(
        CoverageParserFactory.parseContent("unknown content")
      ).rejects.toThrow("Unable to detect coverage format");
    });
  });

  describe("getSupportedFormats", () => {
    it("should return all supported formats", () => {
      const formats = CoverageParserFactory.getSupportedFormats();
      expect(formats).toContain("clover");
      expect(formats).toContain("cobertura");
      expect(formats).toContain("jacoco");
      expect(formats).toContain("lcov");
      expect(formats).toContain("istanbul");
      expect(formats).toContain("go");
      expect(formats).toHaveLength(6);
    });
  });

  describe("aggregateResults", () => {
    it("should aggregate multiple results", async () => {
      const result1 = await CoverageParserFactory.parseContent(lcovContent);
      const result2 = await CoverageParserFactory.parseContent(goCoverage);

      const aggregated = CoverageParserFactory.aggregateResults([
        result1,
        result2,
      ]);

      // Combined files from both results
      expect(aggregated.files.length).toBeGreaterThanOrEqual(2);

      // Combined metrics
      expect(aggregated.totalStatements).toBe(
        result1.metrics.statements + result2.metrics.statements
      );
    });

    it("should handle empty results array", () => {
      const aggregated = CoverageParserFactory.aggregateResults([]);

      expect(aggregated.totalStatements).toBe(0);
      expect(aggregated.lineRate).toBe(0);
      expect(aggregated.files).toHaveLength(0);
    });
  });
});
