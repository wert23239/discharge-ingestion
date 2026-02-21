import { describe, it, expect } from 'vitest';
import { validatePhone, verifyInsurance } from './enrichment';

describe('validatePhone', () => {
  it('validates a 555 number as mobile', async () => {
    const result = await validatePhone('555-867-5309');
    expect(result.valid).toBe(true);
    expect(result.type).toBe('mobile');
    expect(result.carrier).toBe('Verizon Wireless');
  });

  it('identifies 404 area code as landline', async () => {
    const result = await validatePhone('404-123-4567');
    expect(result.valid).toBe(true);
    expect(result.type).toBe('landline');
    expect(result.carrier).toBe('AT&T Southeast');
  });

  it('rejects short numbers', async () => {
    const result = await validatePhone('12345');
    expect(result.valid).toBe(false);
    expect(result.type).toBe('invalid');
  });

  it('handles empty input', async () => {
    const result = await validatePhone('');
    expect(result.valid).toBe(false);
    expect(result.type).toBe('invalid');
  });

  it('defaults to valid mobile for standard numbers', async () => {
    const result = await validatePhone('212-555-0100');
    expect(result.valid).toBe(true);
    // 212 contains 555 so this hits the 555 branch
  });
});

describe('verifyInsurance', () => {
  it('verifies known insurance', async () => {
    const result = await verifyInsurance('BCBS', 'EP123456789');
    expect(result.verified).toBe(true);
    expect(result.planName).toContain('Blue Cross');
    expect(result.status).toBe('Active');
  });

  it('handles unknown insurance', async () => {
    const result = await verifyInsurance('RandomIns', 'EP999999999');
    expect(result.verified).toBe(false);
    expect(result.status).toBe('Unknown');
  });

  it('handles Self Pay', async () => {
    const result = await verifyInsurance('Self Pay', 'EP111111111');
    expect(result.verified).toBe(true);
    expect(result.status).toBe('N/A');
  });
});
