import { describe, it, expect } from 'vitest';
import { parseDischargeText } from '../src/services/pdfParser';

describe('parseDischargeText - edge cases', () => {
  it('should handle text with only whitespace', () => {
    const result = parseDischargeText('   \n  \n   ');
    expect(result.records).toHaveLength(0);
  });

  it('should handle text with no Epic IDs', () => {
    const result = parseDischargeText('Some random text\nAnother line\nNo data here');
    expect(result.records).toHaveLength(0);
  });

  it('should extract hospital name when present', () => {
    const result = parseDischargeText('General Hospital Discharges for Jan 1st, 2024\n');
    expect(result.hospitalName).toBe('General Hospital');
    expect(result.reportDate).toBe('Jan 1st, 2024');
  });

  it('should handle a single record with minimal data', () => {
    const result = parseDischargeText('Doe, JohnEP12345678901-01-2024Home');
    expect(result.records).toHaveLength(1);
    expect(result.records[0].patientName).toBe('Doe, John');
    expect(result.records[0].epicId).toBe('EP123456789');
    expect(result.records[0].disposition).toBe('Home');
  });

  it('should handle concatenated text without spaces', () => {
    const text = 'Smith, JaneEP9876543212025551234Jones, MD Bob01-15-2024Wilson, Amy MDBCBSHome';
    const result = parseDischargeText(text);
    expect(result.records).toHaveLength(1);
    const r = result.records[0];
    expect(r.patientName).toBe('Smith, Jane');
    expect(r.epicId).toBe('EP987654321');
    expect(r.phoneNumber).toBe('202-555-1234');
  });

  it('should handle all dispositions', () => {
    const dispositions = ['Home', 'SNF', 'HHS', 'Rehab', 'AMA', 'Hospice', 'LTAC', 'Deceased'];
    for (const disp of dispositions) {
      const text = `Test, PatientEP00000000101-01-2024${disp}`;
      const result = parseDischargeText(text);
      expect(result.records[0].disposition).toBe(disp);
    }
  });

  it('should handle unknown disposition with reduced confidence', () => {
    const text = 'Test, PatientEP00000000101-01-2024SomePlace';
    const result = parseDischargeText(text);
    expect(result.records[0].disposition).toBe('Unknown');
    expect(result.records[0].confidence).toBeLessThan(1.0);
  });

  it('should preserve rawText for each record', () => {
    const line = 'Sunshine, MelodyEP001234567202-555-0152Kildare, James MD07-04-2023Bailey, Miranda MDBCBSHome';
    const result = parseDischargeText(line);
    expect(result.records[0].rawText).toBe(line);
  });

  it('should handle multiple records', () => {
    const text = `Sacred Heart Hospital Discharges for July 4th, 2023
Sunshine, MelodyEP001234567202-555-0152Kildare, James MD07-04-2023Bailey, Miranda MDBCBSHome
Bacon, Chris P.EP0012376544047271234Manning, Steward Wallace PA07-04-2023Sloan, MD Mark Self PaySNF`;
    const result = parseDischargeText(text);
    expect(result.records).toHaveLength(2);
  });
});
