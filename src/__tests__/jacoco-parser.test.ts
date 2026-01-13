import { describe, expect, it } from "vitest";
import { JaCoCoParser } from "../parsers/jacoco-parser.js";

describe("JaCoCoParser", () => {
  const sampleJaCoCoXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE report PUBLIC "-//JACOCO//DTD Report 1.1//EN" "report.dtd">
<report name="TestProject">
  <sessioninfo id="test-session" start="1234567890000" dump="1234567899000"/>
  <package name="com/example">
    <class name="com/example/Calculator" sourcefilename="Calculator.java">
      <method name="add" desc="(II)I" line="5">
        <counter type="INSTRUCTION" missed="0" covered="10"/>
        <counter type="LINE" missed="0" covered="3"/>
        <counter type="BRANCH" missed="0" covered="0"/>
        <counter type="METHOD" missed="0" covered="1"/>
      </method>
      <method name="divide" desc="(II)I" line="10">
        <counter type="INSTRUCTION" missed="5" covered="8"/>
        <counter type="LINE" missed="1" covered="4"/>
        <counter type="BRANCH" missed="1" covered="1"/>
        <counter type="METHOD" missed="0" covered="1"/>
      </method>
      <counter type="INSTRUCTION" missed="5" covered="18"/>
      <counter type="LINE" missed="1" covered="7"/>
      <counter type="BRANCH" missed="1" covered="1"/>
      <counter type="METHOD" missed="0" covered="2"/>
      <counter type="CLASS" missed="0" covered="1"/>
    </class>
    <sourcefile name="Calculator.java">
      <line nr="5" mi="0" ci="3" mb="0" cb="0"/>
      <line nr="6" mi="0" ci="4" mb="0" cb="0"/>
      <line nr="7" mi="0" ci="3" mb="0" cb="0"/>
      <line nr="10" mi="0" ci="2" mb="0" cb="0"/>
      <line nr="11" mi="0" ci="3" mb="1" cb="1"/>
      <line nr="12" mi="0" ci="2" mb="0" cb="0"/>
      <line nr="13" mi="0" ci="1" mb="0" cb="0"/>
      <line nr="14" mi="5" ci="0" mb="0" cb="0"/>
      <counter type="INSTRUCTION" missed="5" covered="18"/>
      <counter type="LINE" missed="1" covered="7"/>
      <counter type="BRANCH" missed="1" covered="1"/>
      <counter type="METHOD" missed="0" covered="2"/>
    </sourcefile>
  </package>
  <package name="com/example/utils">
    <sourcefile name="Helper.java">
      <line nr="1" mi="0" ci="5" mb="0" cb="0"/>
      <line nr="2" mi="0" ci="3" mb="0" cb="0"/>
      <line nr="3" mi="0" ci="2" mb="0" cb="0"/>
      <counter type="INSTRUCTION" missed="0" covered="10"/>
      <counter type="LINE" missed="0" covered="3"/>
      <counter type="BRANCH" missed="0" covered="0"/>
      <counter type="METHOD" missed="0" covered="1"/>
    </sourcefile>
  </package>
  <counter type="INSTRUCTION" missed="5" covered="28"/>
  <counter type="LINE" missed="1" covered="10"/>
  <counter type="BRANCH" missed="1" covered="1"/>
  <counter type="METHOD" missed="0" covered="3"/>
  <counter type="CLASS" missed="0" covered="2"/>
</report>`;

  it("should parse JaCoCo XML correctly", async () => {
    const parser = new JaCoCoParser();
    const result = await parser.parseContent(sampleJaCoCoXML);

    expect(result.files).toHaveLength(2);
  });

  it("should calculate correct coverage metrics from report counters", async () => {
    const parser = new JaCoCoParser();
    const result = await parser.parseContent(sampleJaCoCoXML);

    // From report-level counters
    expect(result.metrics.statements).toBe(11); // LINE: missed=1, covered=10
    expect(result.metrics.coveredStatements).toBe(10);
    expect(result.metrics.conditionals).toBe(2); // BRANCH: missed=1, covered=1
    expect(result.metrics.coveredConditionals).toBe(1);
    expect(result.metrics.methods).toBe(3);
    expect(result.metrics.coveredMethods).toBe(3);
  });

  it("should parse file coverage correctly", async () => {
    const parser = new JaCoCoParser();
    const result = await parser.parseContent(sampleJaCoCoXML);

    const calcFile = result.files.find((f) => f.name === "Calculator.java");
    expect(calcFile).toBeDefined();
    expect(calcFile!.path).toBe("com/example/Calculator.java");
    expect(calcFile!.statements).toBe(8); // LINE counter
    expect(calcFile!.coveredStatements).toBe(7);
    expect(calcFile!.conditionals).toBe(2);
    expect(calcFile!.coveredConditionals).toBe(1);

    const helperFile = result.files.find((f) => f.name === "Helper.java");
    expect(helperFile).toBeDefined();
    expect(helperFile!.path).toBe("com/example/utils/Helper.java");
    expect(helperFile!.statements).toBe(3);
    expect(helperFile!.coveredStatements).toBe(3);
    expect(helperFile!.lineRate).toBe(100);
  });

  it("should parse line coverage correctly", async () => {
    const parser = new JaCoCoParser();
    const result = await parser.parseContent(sampleJaCoCoXML);

    const calcFile = result.files.find((f) => f.name === "Calculator.java");
    expect(calcFile!.lines).toHaveLength(8);

    // Covered line without branches
    const line5 = calcFile!.lines.find((l) => l.lineNumber === 5);
    expect(line5?.count).toBe(3);
    expect(line5?.type).toBe("stmt");

    // Line with branches
    const line11 = calcFile!.lines.find((l) => l.lineNumber === 11);
    expect(line11?.count).toBe(3);
    expect(line11?.type).toBe("cond");
    expect(line11?.trueCount).toBe(1);
    expect(line11?.falseCount).toBe(1);

    // Uncovered line
    const line14 = calcFile!.lines.find((l) => l.lineNumber === 14);
    expect(line14?.count).toBe(0);
  });

  it("should detect JaCoCo format correctly", () => {
    const parser = new JaCoCoParser();

    expect(parser.canParse(sampleJaCoCoXML)).toBe(true);
    expect(parser.canParse(sampleJaCoCoXML, "jacoco.xml")).toBe(true);
    expect(parser.canParse(sampleJaCoCoXML, "report.xml")).toBe(true);

    // Should not match Cobertura format
    const coberturaXML = `<coverage line-rate="0.5"><packages></packages></coverage>`;
    expect(parser.canParse(coberturaXML)).toBe(false);

    // Should not match Clover format
    const cloverXML = `<coverage clover="3.2.0"><project></project></coverage>`;
    expect(parser.canParse(cloverXML)).toBe(false);

    // Should not match non-XML
    expect(parser.canParse("not xml", "file.json")).toBe(false);
  });

  it("should handle single package/sourcefile", async () => {
    const singlePackageXML = `<?xml version="1.0"?>
<report name="test">
  <package name="pkg">
    <sourcefile name="File.java">
      <line nr="1" mi="0" ci="5" mb="0" cb="0"/>
      <counter type="LINE" missed="0" covered="1"/>
    </sourcefile>
  </package>
  <counter type="LINE" missed="0" covered="1"/>
  <counter type="BRANCH" missed="0" covered="0"/>
  <counter type="METHOD" missed="0" covered="1"/>
</report>`;

    const parser = new JaCoCoParser();
    const result = await parser.parseContent(singlePackageXML);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].name).toBe("File.java");
    expect(result.files[0].path).toBe("pkg/File.java");
  });

  it("should handle empty coverage", async () => {
    const emptyXML = `<?xml version="1.0"?>
<report name="empty">
  <package name="pkg">
    <sourcefile name="Empty.java">
      <line nr="1" mi="5" ci="0" mb="0" cb="0"/>
      <counter type="LINE" missed="1" covered="0"/>
      <counter type="BRANCH" missed="0" covered="0"/>
      <counter type="METHOD" missed="1" covered="0"/>
    </sourcefile>
  </package>
  <counter type="LINE" missed="1" covered="0"/>
  <counter type="BRANCH" missed="0" covered="0"/>
  <counter type="METHOD" missed="1" covered="0"/>
</report>`;

    const parser = new JaCoCoParser();
    const result = await parser.parseContent(emptyXML);

    expect(result.metrics.lineRate).toBe(0);
    expect(result.files[0].coveredStatements).toBe(0);
  });

  it("should have correct format property", () => {
    const parser = new JaCoCoParser();
    expect(parser.format).toBe("jacoco");
  });
});
