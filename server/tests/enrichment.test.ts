import { describe, it, expect } from 'vitest';
import { validatePhone, verifyInsurance } from '../src/services/enrichment';

describe('validatePhone', () => {
  it('should return invalid for empty string', async () => {
    const result = await validatePhone('');
    expect(result.valid).toBe(false);
    expect(result.type).toBe('invalid');
  });

  it('should return valid mobile for 555 numbers', async () => {
    const result = await validatePhone('202-555-0152');
    expect(result.valid).toBe(true);
    expect(result.type).toBe('mobile');
    expect(result.formatted).toBe('+12025550152');
  });

  it('should return landline for 404 area code', async () => {
    const result = await validatePhone('404-727-1234');
    expect(result.valid).toBe(true);
    expect(result.type).toBe('landline');
  });

  it('should return invalid for short numbers', async () => {
    const result = await validatePhone('12345');
    expect(result.valid).toBe(false);
    expect(result.type).toBe('invalid');
  });

  it('should return valid for standard 10-digit numbers', async () => {
    const result = await validatePhone('301-555-9999');
    expect(result.valid).toBe(true);
  });
});

describe('verifyInsurance', () => {
  it('should verify known insurance BCBS', async () => {
    const result = await verifyInsurance('BCBS', 'EP001234567');
    expect(result.verified).toBe(true);
    expect(result.planName).toContain('Blue Cross');
  });

  it('should return unverified for unknown insurance', async () => {
    const result = await verifyInsurance('FakeInsurance', 'EP001234567');
    expect(result.verified).toBe(false);
  });

  it('should handle Self Pay', async () => {
    const result = await verifyInsurance('Self Pay', 'EP001237654');
    expect(result.verified).toBe(true);
    expect(result.status).toBe('N/A');
  });
});
