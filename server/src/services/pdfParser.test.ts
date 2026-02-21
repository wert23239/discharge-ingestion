import { describe, it, expect } from 'vitest';
import { parseDischargeText } from './pdfParser';

const SAMPLE_TEXT = `Sacred Heart Hospital Discharges for 01-15-2025
Patient Name | Epic ID | Phone | Attending | Date | PCP | Insurance | Disposition
Johnson, Sarah EP123456789 555-867-5309 Sloan, MD Mark 01-15-2025 Grey, Meredith MD BCBS Home
Smith, Robert EP987654321 404-555-1234 Yang, Cristina DO 01-15-2025 (missing) Aetna Health SNF
Doe, Jane EP111222333 (missing) Bailey, Miranda MD 01-15-2025 Webber, Richard MD Self Pay AMA`;

describe('parseDischargeText', () => {
  const result = parseDischargeText(SAMPLE_TEXT);

  it('extracts hospital name and report date', () => {
    expect(result.hospitalName).toBe('Sacred Heart Hospital');
    expect(result.reportDate).toBe('01-15-2025');
  });

  it('parses all data rows', () => {
    expect(result.records).toHaveLength(3);
  });

  it('parses patient names correctly', () => {
    expect(result.records[0].patientName).toBe('Johnson, Sarah');
    expect(result.records[1].patientName).toBe('Smith, Robert');
    expect(result.records[2].patientName).toBe('Doe, Jane');
  });

  it('extracts Epic IDs', () => {
    expect(result.records[0].epicId).toBe('EP123456789');
    expect(result.records[1].epicId).toBe('EP987654321');
    expect(result.records[2].epicId).toBe('EP111222333');
  });

  it('handles phone numbers (formatted, raw, and missing)', () => {
    expect(result.records[0].phoneNumber).toBe('555-867-5309');
    // 404 area code with formatted number
    expect(result.records[1].phoneNumber).toContain('404');
    // Missing phone
    expect(result.records[2].phoneNumber).toBeNull();
  });

  it('extracts discharge dates', () => {
    expect(result.records[0].dischargeDate).toBe('01-15-2025');
  });

  it('extracts dispositions', () => {
    expect(result.records[0].disposition).toBe('Home');
    expect(result.records[1].disposition).toBe('SNF');
    expect(result.records[2].disposition).toBe('AMA');
  });

  it('extracts insurance', () => {
    expect(result.records[0].insurance).toBe('BCBS');
    expect(result.records[1].insurance).toBe('Aetna Health');
    expect(result.records[2].insurance).toBe('Self Pay');
  });

  it('assigns confidence scores', () => {
    result.records.forEach((r) => {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    });
  });

  it('normalizes provider name credentials', () => {
    // "Sloan, MD Mark" → "Sloan, Mark MD"
    expect(result.records[0].attendingPhysician).toBe('Sloan, Mark MD');
  });

  it('handles empty input', () => {
    const empty = parseDischargeText('');
    expect(empty.records).toHaveLength(0);
    expect(empty.hospitalName).toBe('Unknown Hospital');
  });

  it('handles no Epic IDs', () => {
    const noData = parseDischargeText('Some random text without any data rows');
    expect(noData.records).toHaveLength(0);
  });
});
