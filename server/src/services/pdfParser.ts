export interface ParsedDischarge {
  patientName: string;
  epicId: string;
  phoneNumber: string | null;
  attendingPhysician: string;
  dischargeDate: string;
  primaryCareProvider: string | null;
  insurance: string;
  disposition: string;
  confidence: number;
  rawText: string;
}

export interface ParseResult {
  hospitalName: string;
  reportDate: string;
  records: ParsedDischarge[];
  rawText: string;
}

// Known disposition values in Isaac's discharge system
const DISPOSITIONS = ['Home', 'SNF', 'HHS', 'Rehab', 'AMA', 'Hospice', 'LTAC', 'Deceased'];

// Known insurance patterns
const INSURANCE_PATTERNS = [
  'BCBS', 'Blue Cross', 'Aetna', 'Aetna Health', 'Humana', 'Humana Health',
  'UnitedHealthcare', 'United', 'Cigna', 'Medicare', 'Medicaid',
  'Self Pay', 'Self-Pay', 'Tricare', 'Kaiser',
];

/**
 * Parse the Sacred Heart Hospital discharge PDF format.
 *
 * The PDF text extraction produces concatenated fields with NO delimiters.
 * We use known patterns as anchors:
 *   - Epic IDs: EP followed by 9 digits
 *   - Phone numbers: 10-digit sequences or formatted (XXX-XXX-XXXX)
 *   - Dates: MM-DD-YYYY format
 *   - Dispositions: Known set of values at end of line
 *   - Insurance: Known patterns before disposition
 *
 * This is a heuristic parser designed for the Sacred Heart format.
 * For unknown formats, an LLM-based fallback would be appropriate.
 */
export function parseDischargeText(text: string): ParseResult {
  // Pre-process: if text contains pipe delimiters (e.g. from formatted tables),
  // strip them so the heuristic parser can work on concatenated text.
  const lines = text.split('\n')
    .map((l) => l.replace(/\s*\|\s*/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter((l) => l.length > 0);

  // Extract hospital name and date from header
  let hospitalName = 'Unknown Hospital';
  let reportDate = '';

  const headerLine = lines.find(
    (l) => l.toLowerCase().includes('hospital') && l.toLowerCase().includes('discharges')
  );
  if (headerLine) {
    const headerMatch = headerLine.match(/^(.+?)\s+Discharges\s+for\s+(.+)$/i);
    if (headerMatch) {
      hospitalName = headerMatch[1].trim();
      reportDate = headerMatch[2].trim();
    }
  }

  // Find lines containing Epic IDs — these are data rows
  // Epic IDs are exactly EP + 9 digits
  const epicIdPattern = /EP\d{9}/;
  const dataLines = lines.filter((l) => epicIdPattern.test(l));

  const records: ParsedDischarge[] = dataLines.map((line) => {
    return parseDischargeRow(line);
  });

  return { hospitalName, reportDate, records, rawText: text };
}

/**
 * Parse a single concatenated discharge row using pattern anchors.
 *
 * Strategy: identify fixed-format fields first (Epic ID, date, phone),
 * then use their positions to extract the variable-length text fields
 * (name, attending, PCP, insurance, disposition).
 */
function parseDischargeRow(line: string): ParsedDischarge {
  let confidence = 1.0;

  // 1. Extract Epic ID (EP followed by exactly 9 digits)
  //    The ID is always EP + 9 digits. In concatenated text, digits may continue
  //    into the phone number, so we grab exactly 9 after EP.
  const epicMatch = line.match(/(EP\d{9})/);
  const epicId = epicMatch ? epicMatch[1] : '';
  if (!epicId) confidence -= 0.2;

  // 2. Extract date (MM-DD-YYYY)
  const dateMatch = line.match(/(\d{2}-\d{2}-\d{4})/);
  const dischargeDate = dateMatch ? dateMatch[1] : '';
  if (!dischargeDate) confidence -= 0.2;

  // 3. Extract phone number
  //    Phone appears immediately after the Epic ID in the concatenated text.
  //    It can be formatted (XXX-XXX-XXXX) or raw digits (XXXXXXXXXX).
  //    Some patients have no phone (text goes straight to attending name).
  let phoneNumber: string | null = null;
  let phoneConfidence = 0;
  let phoneMatch: RegExpMatchArray | null = null;

  const epicEndIdx = epicId ? line.indexOf(epicId) + epicId.length : -1;
  if (epicEndIdx > 0) {
    const afterEpic = line.substring(epicEndIdx);
    // Check for "(missing)" placeholder first
    const missingPhone = afterEpic.match(/^\s*\(missing\)\s*/i);
    if (missingPhone) {
      phoneNumber = null;
      // Create a synthetic match so attending extraction skips past it
      phoneMatch = missingPhone;
    }

    // Try formatted phone first: XXX-XXX-XXXX (allow leading whitespace)
    const fmtPhone = !missingPhone && afterEpic.match(/^\s*(\d{3}-\d{3}-\d{4})/);
    if (fmtPhone) {
      phoneNumber = fmtPhone[1];
      phoneConfidence = 1.0;
      phoneMatch = fmtPhone;
    } else {
      // Try raw 10-digit phone (allow leading whitespace, followed by letter or space+letter)
      const rawPhone = afterEpic.match(/^\s*(\d{10})(?=\s|[A-Z])/);
      if (rawPhone) {
        const d = rawPhone[1];
        phoneNumber = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
        phoneConfidence = 0.9;
        phoneMatch = rawPhone;
      }
      // else: no phone found (e.g. Mellow patient)
    }
  }

  // 4. Extract disposition (last known value at end of line)
  let disposition = '';
  const lineEnd = line.trim();
  for (const disp of DISPOSITIONS) {
    if (lineEnd.endsWith(disp)) {
      disposition = disp;
      break;
    }
  }
  if (!disposition) {
    disposition = 'Unknown';
    confidence -= 0.1;
  }

  // 5. Extract patient name (everything before the Epic ID)
  let patientName = '';
  if (epicId) {
    const epicIdx = line.indexOf(epicId);
    patientName = line.substring(0, epicIdx).trim();
  }
  if (!patientName) {
    patientName = 'Unknown';
    confidence -= 0.2;
  }

  // 6. Extract the middle section: between phone/epic and date = attending
  //    between date and disposition = PCP + insurance
  let attendingPhysician = '';
  let primaryCareProvider: string | null = null;
  let insurance = '';

  if (dateMatch && epicId) {
    const dateIdx = line.indexOf(dischargeDate);
    const epicEnd = line.indexOf(epicId) + epicId.length;

    // Section between Epic+phone and date = attending physician
    let attendingStart = epicEnd;
    if (phoneMatch) {
      const matchStr = phoneMatch[1] || phoneMatch[0];
      const phoneIdx = line.indexOf(matchStr, epicEnd);
      if (phoneIdx >= 0) {
        attendingStart = phoneIdx + matchStr.length;
      }
    }
    attendingPhysician = line.substring(attendingStart, dateIdx).trim();

    // Section between date and disposition = PCP + insurance
    const afterDate = line.substring(dateIdx + dischargeDate.length);
    const beforeDisposition = disposition !== 'Unknown'
      ? afterDate.substring(0, afterDate.lastIndexOf(disposition))
      : afterDate;

    // Try to split PCP and insurance from this section
    const pcpAndInsurance = beforeDisposition.trim();
    const { pcp, ins } = splitPcpAndInsurance(pcpAndInsurance);
    primaryCareProvider = pcp && pcp.toLowerCase().includes('missing') ? null : pcp;
    insurance = ins;
  }

  // 7. Normalize provider names (fix credential placement)
  attendingPhysician = normalizeProviderName(attendingPhysician);
  if (primaryCareProvider) {
    primaryCareProvider = normalizeProviderName(primaryCareProvider);
  }

  // Adjust confidence for missing fields
  if (!phoneNumber) confidence -= 0.1;
  if (!primaryCareProvider) confidence -= 0.1;
  if (insurance === 'Unknown') confidence -= 0.1;

  return {
    patientName,
    epicId,
    phoneNumber,
    attendingPhysician,
    dischargeDate,
    primaryCareProvider,
    insurance: insurance || 'Unknown',
    disposition,
    confidence: Math.max(0, Math.round(confidence * 100) / 100),
    rawText: line,
  };
}

/**
 * Split the PCP + Insurance section.
 *
 * This section has no delimiter. We use known insurance patterns
 * to find where PCP ends and insurance begins.
 */
function splitPcpAndInsurance(text: string): { pcp: string | null; ins: string } {
  if (!text) return { pcp: null, ins: 'Unknown' };

  // Try matching known insurance patterns (longest match first)
  const sorted = [...INSURANCE_PATTERNS].sort((a, b) => b.length - a.length);
  for (const pattern of sorted) {
    const idx = text.indexOf(pattern);
    if (idx >= 0) {
      const pcp = text.substring(0, idx).trim() || null;
      const ins = pattern;
      return { pcp, ins };
    }
  }

  // If no insurance pattern found, the whole thing might be just PCP or just insurance
  // Check if it looks like a name (contains MD, DO, etc.)
  if (/\b(MD|DO|PA|NP|RN)\b/i.test(text)) {
    return { pcp: text.trim(), ins: 'Unknown' };
  }

  // Otherwise treat as insurance
  return { pcp: null, ins: text.trim() || 'Unknown' };
}

/**
 * Normalize provider name: fix credential placement.
 * "Sloan, MD Mark" → "Sloan, Mark MD"
 * "Manning, Steward Wallace PA" stays as-is (already correct)
 */
function normalizeProviderName(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Pattern: "LastName, CREDENTIALS FirstName"
  const wrongOrder = trimmed.match(
    /^([^,]+),\s+(MD|DO|PA|NP|PA-C|RN|BSN)\s+(.+)$/i
  );
  if (wrongOrder) {
    return `${wrongOrder[1]}, ${wrongOrder[3]} ${wrongOrder[2].toUpperCase()}`;
  }

  return trimmed;
}

/**
 * Extract text from a PDF buffer and parse it.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParseResult> {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return parseDischargeText(data.text);
}
