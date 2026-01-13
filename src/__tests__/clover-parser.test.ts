import { describe, expect, it } from "vitest";
import { CloverParser } from "../parsers/clover-parser.js";

describe("CloverParser", () => {
  const sampleCloverXML = `<?xml version="1.0" encoding="UTF-8"?>
<coverage generated="1764746556005" clover="3.2.0">
  <project timestamp="1764746556005" name="All files">
    <metrics statements="10" coveredstatements="7" conditionals="4" coveredconditionals="2" methods="3" coveredmethods="2" elements="17" coveredelements="11" complexity="0" loc="10" ncloc="10" packages="1" files="2" classes="2"/>
    <file name="math.ts" path="/src/utils/math.ts">
      <metrics statements="6" coveredstatements="4" conditionals="2" coveredconditionals="1" methods="2" coveredmethods="1"/>
      <line num="1" count="5" type="stmt"/>
      <line num="2" count="3" type="stmt"/>
      <line num="3" count="0" type="stmt"/>
      <line num="4" count="2" type="cond" truecount="1" falsecount="1"/>
      <line num="5" count="1" type="stmt"/>
      <line num="6" count="0" type="stmt"/>
    </file>
    <file name="utils.ts" path="/src/utils/utils.ts">
      <metrics statements="4" coveredstatements="3" conditionals="2" coveredconditionals="1" methods="1" coveredmethods="1"/>
      <line num="10" count="8" type="stmt"/>
      <line num="11" count="5" type="stmt"/>
      <line num="12" count="0" type="stmt"/>
      <line num="13" count="3" type="cond" truecount="1" falsecount="1"/>
    </file>
  </project>
</coverage>`;

  it("should parse Clover XML correctly", async () => {
    const parser = new CloverParser();
    const result = await parser.parseContent(sampleCloverXML);

    expect(result.timestamp).toBe(1764746556005);
    expect(result.metrics.statements).toBe(10);
    expect(result.metrics.coveredStatements).toBe(7);
    expect(result.metrics.conditionals).toBe(4);
    expect(result.metrics.coveredConditionals).toBe(2);
    expect(result.metrics.methods).toBe(3);
    expect(result.metrics.coveredMethods).toBe(2);
    expect(result.metrics.lineRate).toBe(70);
    expect(result.metrics.branchRate).toBe(50);
  });

  it("should parse files correctly", async () => {
    const parser = new CloverParser();
    const result = await parser.parseContent(sampleCloverXML);

    expect(result.files).toHaveLength(2);

    const mathFile = result.files[0];
    expect(mathFile.name).toBe("math.ts");
    expect(mathFile.path).toBe("/src/utils/math.ts");
    expect(mathFile.statements).toBe(6);
    expect(mathFile.coveredStatements).toBe(4);
    expect(mathFile.conditionals).toBe(2);
    expect(mathFile.coveredConditionals).toBe(1);
    expect(mathFile.lineRate).toBe(66.67);
    expect(mathFile.branchRate).toBe(50);
    expect(mathFile.lines).toHaveLength(6);
  });

  it("should parse line coverage correctly", async () => {
    const parser = new CloverParser();
    const result = await parser.parseContent(sampleCloverXML);

    const mathFile = result.files[0];
    const firstLine = mathFile.lines[0];

    expect(firstLine.lineNumber).toBe(1);
    expect(firstLine.count).toBe(5);
    expect(firstLine.type).toBe("stmt");

    const condLine = mathFile.lines[3];
    expect(condLine.lineNumber).toBe(4);
    expect(condLine.type).toBe("cond");
    expect(condLine.trueCount).toBe(1);
    expect(condLine.falseCount).toBe(1);
  });

  it("should aggregate multiple coverage results", async () => {
    const parser = new CloverParser();
    const result1 = await parser.parseContent(sampleCloverXML);

    const sampleCloverXML2 = `<?xml version="1.0" encoding="UTF-8"?>
<coverage generated="1764746556005" clover="3.2.0">
  <project timestamp="1764746556005" name="All files">
    <metrics statements="5" coveredstatements="3" conditionals="2" coveredconditionals="1" methods="1" coveredmethods="1" elements="8" coveredelements="5"/>
    <file name="helper.ts" path="/src/helper.ts">
      <metrics statements="5" coveredstatements="3" conditionals="2" coveredconditionals="1" methods="1" coveredmethods="1"/>
      <line num="1" count="3" type="stmt"/>
      <line num="2" count="0" type="stmt"/>
      <line num="3" count="2" type="stmt"/>
      <line num="4" count="0" type="stmt"/>
      <line num="5" count="1" type="cond" truecount="1" falsecount="1"/>
    </file>
  </project>
</coverage>`;

    const result2 = await parser.parseContent(sampleCloverXML2);

    const aggregated = CloverParser.aggregateResults([result1, result2]);

    expect(aggregated.totalStatements).toBe(15); // 10 + 5
    expect(aggregated.coveredStatements).toBe(10); // 7 + 3
    expect(aggregated.totalConditionals).toBe(6); // 4 + 2
    expect(aggregated.coveredConditionals).toBe(3); // 2 + 1
    expect(aggregated.totalMethods).toBe(4); // 3 + 1
    expect(aggregated.coveredMethods).toBe(3); // 2 + 1
    expect(aggregated.lineRate).toBe(66.67);
    expect(aggregated.branchRate).toBe(50);
    expect(aggregated.files).toHaveLength(3);
  });

  it("should handle coverage with no conditionals", async () => {
    const xmlWithNoConditionals = `<?xml version="1.0" encoding="UTF-8"?>
<coverage generated="1764746556005" clover="3.2.0">
  <project timestamp="1764746556005" name="All files">
    <metrics statements="3" coveredstatements="3" conditionals="0" coveredconditionals="0" methods="1" coveredmethods="1" elements="4" coveredelements="4"/>
    <file name="simple.ts" path="/src/simple.ts">
      <metrics statements="3" coveredstatements="3" conditionals="0" coveredconditionals="0" methods="1" coveredmethods="1"/>
      <line num="1" count="1" type="stmt"/>
      <line num="2" count="1" type="stmt"/>
      <line num="3" count="1" type="stmt"/>
    </file>
  </project>
</coverage>`;

    const parser = new CloverParser();
    const result = await parser.parseContent(xmlWithNoConditionals);

    expect(result.metrics.lineRate).toBe(100);
    expect(result.metrics.branchRate).toBe(0); // No branches to cover
  });

  it("should handle zero coverage", async () => {
    const xmlWithZeroCoverage = `<?xml version="1.0" encoding="UTF-8"?>
<coverage generated="1764746556005" clover="3.2.0">
  <project timestamp="1764746556005" name="All files">
    <metrics statements="5" coveredstatements="0" conditionals="2" coveredconditionals="0" methods="2" coveredmethods="0" elements="9" coveredelements="0"/>
    <file name="uncovered.ts" path="/src/uncovered.ts">
      <metrics statements="5" coveredstatements="0" conditionals="2" coveredconditionals="0" methods="2" coveredmethods="0"/>
      <line num="1" count="0" type="stmt"/>
      <line num="2" count="0" type="stmt"/>
      <line num="3" count="0" type="stmt"/>
      <line num="4" count="0" type="cond" truecount="0" falsecount="2"/>
      <line num="5" count="0" type="stmt"/>
    </file>
  </project>
</coverage>`;

    const parser = new CloverParser();
    const result = await parser.parseContent(xmlWithZeroCoverage);

    expect(result.metrics.lineRate).toBe(0);
    expect(result.metrics.branchRate).toBe(0);
    expect(result.files[0].coveredStatements).toBe(0);
  });

  it("should detect Clover format correctly", () => {
    const parser = new CloverParser();

    expect(parser.canParse(sampleCloverXML)).toBe(true);
    expect(parser.canParse(sampleCloverXML, "clover.xml")).toBe(true);

    // Should not match Cobertura
    const coberturaXML = `<coverage line-rate="0.5"><packages></packages></coverage>`;
    expect(parser.canParse(coberturaXML)).toBe(false);
  });

  it("should have correct format property", () => {
    const parser = new CloverParser();
    expect(parser.format).toBe("clover");
  });
});
