import JSZip from 'jszip';
import type { ParsedArtifact } from '../types';

export async function parseArtifact(zipData: ArrayBuffer): Promise<ParsedArtifact> {
  const zip = await JSZip.loadAsync(zipData);
  
  // Find test-results.json or coverage-results.json
  const testFile = zip.file('test-results.json');
  const coverageFile = zip.file('coverage-results.json');
  
  const results: ParsedArtifact = {};
  
  if (testFile) {
    try {
      const content = await testFile.async('string');
      const testData = JSON.parse(content);
      results.tests = {
        totalTests: testData.totalTests || 0,
        passedTests: testData.passedTests || 0,
        failedTests: testData.failedTests || 0,
        skippedTests: testData.skippedTests || 0,
        passRate: testData.passRate || 0,
        totalTime: testData.totalTime || 0,
      };
    } catch (error) {
      console.error('Error parsing test results:', error);
    }
  }
  
  if (coverageFile) {
    try {
      const content = await coverageFile.async('string');
      const coverageData = JSON.parse(content);
      results.coverage = {
        lineRate: coverageData.lineRate || 0,
        branchRate: coverageData.branchRate || 0,
        totalStatements: coverageData.totalStatements || 0,
        coveredStatements: coverageData.coveredStatements || 0,
        totalConditionals: coverageData.totalConditionals || 0,
        coveredConditionals: coverageData.coveredConditionals || 0,
        totalMethods: coverageData.totalMethods || 0,
        coveredMethods: coverageData.coveredMethods || 0,
      };
    } catch (error) {
      console.error('Error parsing coverage results:', error);
    }
  }
  
  return results;
}

