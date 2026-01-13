import { describe, expect, it } from "vitest";
import { CoberturaParser } from "../parsers/cobertura-parser.js";

describe("CoberturaParser", () => {
  const sampleCoberturaXML = `<?xml version="1.0" ?>
<!DOCTYPE coverage SYSTEM "http://cobertura.sourceforge.net/xml/coverage-04.dtd">
<coverage line-rate="0.7" branch-rate="0.5" lines-covered="7" lines-valid="10" branches-covered="2" branches-valid="4" timestamp="1234567890" version="1.0">
  <packages>
    <package name="src" line-rate="0.7" branch-rate="0.5">
      <classes>
        <class name="math.py" filename="src/math.py" line-rate="0.67" branch-rate="0.5">
          <methods>
            <method name="add" signature="(a, b)">
              <lines>
                <line number="1" hits="5"/>
                <line number="2" hits="3"/>
              </lines>
            </method>
            <method name="divide" signature="(a, b)">
              <lines>
                <line number="5" hits="0"/>
                <line number="6" hits="0"/>
              </lines>
            </method>
          </methods>
          <lines>
            <line number="1" hits="5" branch="false"/>
            <line number="2" hits="3" branch="false"/>
            <line number="3" hits="0" branch="false"/>
            <line number="4" hits="2" branch="true" condition-coverage="50% (1/2)"/>
            <line number="5" hits="0" branch="false"/>
            <line number="6" hits="0" branch="false"/>
          </lines>
        </class>
        <class name="utils.py" filename="src/utils.py" line-rate="1.0" branch-rate="1.0">
          <lines>
            <line number="1" hits="10" branch="false"/>
            <line number="2" hits="8" branch="false"/>
            <line number="3" hits="5" branch="false"/>
            <line number="4" hits="3" branch="true" condition-coverage="100% (2/2)"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>`;

  it("should parse Cobertura XML correctly", async () => {
    const parser = new CoberturaParser();
    const result = await parser.parseContent(sampleCoberturaXML);

    expect(result.timestamp).toBe(1234567890);
    expect(result.files).toHaveLength(2);
  });

  it("should calculate correct coverage metrics", async () => {
    const parser = new CoberturaParser();
    const result = await parser.parseContent(sampleCoberturaXML);

    // Total: 10 statements, 7 covered (from both files)
    expect(result.metrics.statements).toBe(10);
    expect(result.metrics.coveredStatements).toBe(7);
    
    // Total: 4 conditionals (2+2), 3 covered (1+2)
    expect(result.metrics.conditionals).toBe(4);
    expect(result.metrics.coveredConditionals).toBe(3);
  });

  it("should parse file coverage correctly", async () => {
    const parser = new CoberturaParser();
    const result = await parser.parseContent(sampleCoberturaXML);

    const mathFile = result.files.find((f) => f.path === "src/math.py");
    expect(mathFile).toBeDefined();
    expect(mathFile!.name).toBe("math.py");
    expect(mathFile!.statements).toBe(6);
    expect(mathFile!.coveredStatements).toBe(3);
    expect(mathFile!.conditionals).toBe(2);
    expect(mathFile!.coveredConditionals).toBe(1);

    const utilsFile = result.files.find((f) => f.path === "src/utils.py");
    expect(utilsFile).toBeDefined();
    expect(utilsFile!.statements).toBe(4);
    expect(utilsFile!.coveredStatements).toBe(4);
    expect(utilsFile!.lineRate).toBe(100);
  });

  it("should parse line coverage correctly", async () => {
    const parser = new CoberturaParser();
    const result = await parser.parseContent(sampleCoberturaXML);

    const mathFile = result.files.find((f) => f.path === "src/math.py");
    expect(mathFile!.lines).toHaveLength(6);

    const line1 = mathFile!.lines.find((l) => l.lineNumber === 1);
    expect(line1?.count).toBe(5);
    expect(line1?.type).toBe("stmt");

    const line4 = mathFile!.lines.find((l) => l.lineNumber === 4);
    expect(line4?.count).toBe(2);
    expect(line4?.type).toBe("cond");
  });

  it("should detect Cobertura format correctly", () => {
    const parser = new CoberturaParser();

    expect(parser.canParse(sampleCoberturaXML)).toBe(true);
    expect(parser.canParse(sampleCoberturaXML, "coverage.xml")).toBe(true);
    expect(parser.canParse(sampleCoberturaXML, "cobertura.xml")).toBe(true);

    // Should not match Clover format
    const cloverXML = `<coverage clover="3.2.0"><project></project></coverage>`;
    expect(parser.canParse(cloverXML)).toBe(false);

    // Should not match JaCoCo format
    const jacocoXML = `<report name="test"><package name="pkg"></package></report>`;
    expect(parser.canParse(jacocoXML)).toBe(false);

    // Should not match non-XML
    expect(parser.canParse("not xml", "file.json")).toBe(false);
  });

  it("should handle empty coverage", async () => {
    const emptyXML = `<?xml version="1.0" ?>
<coverage line-rate="0" branch-rate="0" timestamp="0">
  <packages>
    <package name="empty">
      <classes>
        <class name="empty.py" filename="empty.py">
          <lines>
            <line number="1" hits="0"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>`;

    const parser = new CoberturaParser();
    const result = await parser.parseContent(emptyXML);

    expect(result.metrics.statements).toBe(1);
    expect(result.metrics.coveredStatements).toBe(0);
    expect(result.metrics.lineRate).toBe(0);
  });

  it("should handle missing optional elements", async () => {
    const minimalXML = `<?xml version="1.0" ?>
<coverage line-rate="0.5" branch-rate="0">
  <packages>
    <package name="pkg">
      <classes>
        <class filename="file.py">
          <lines>
            <line number="1" hits="1"/>
            <line number="2" hits="0"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>`;

    const parser = new CoberturaParser();
    const result = await parser.parseContent(minimalXML);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].statements).toBe(2);
    expect(result.files[0].coveredStatements).toBe(1);
  });

  it("should have correct format property", () => {
    const parser = new CoberturaParser();
    expect(parser.format).toBe("cobertura");
  });
});
