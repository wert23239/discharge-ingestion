# Technical Specification: Discharge List Ingestion Pipeline

## Problem Statement

Sacred Heart Hospital exports daily discharge lists as PDFs from their EHR. These PDFs contain patient discharge records in a semi-structured tabular format. We need to ingest this data into the platform to trigger transitional care management (TCM) outreach campaigns within the CMS-required 2-business-day window.

## Q1: From Unstructured PDF to Structured Output

### Design Space

Three primary approaches exist for extracting structured data from PDF discharge lists, each with distinct tradeoffs:

---

#### Approach A: Rule-Based / Heuristic Parsing

**How it works:** Extract raw text from the PDF using a library (e.g., `pdf-parse`, `pdfplumber`, Apache PDFBox), then apply regex patterns and positional heuristics to identify fields based on the known PDF layout.

**Merits:**
- Deterministic and fast — no external API calls, no latency
- No per-document cost
- Easy to test — same input always produces same output
- No data leaves your infrastructure (HIPAA-friendly)

**Drawbacks:**
- Brittle: breaks when the PDF layout changes (new EHR version, different hospital)
- Requires per-hospital parser configuration
- Struggles with messy data (missing fields, multi-line values, OCR artifacts)

**Best for:** Known, stable PDF formats from a single source.

---

#### Approach B: LLM-Based Extraction

**How it works:** Extract raw text from the PDF, then send it to a large language model (GPT-4, Claude) with a structured extraction prompt. The LLM returns JSON conforming to a predefined schema.

**Merits:**
- Handles layout variations gracefully — robust to format changes
- Can infer missing delimiters and correct minor OCR issues
- Generalizes across hospitals with minimal configuration
- Natural language reasoning handles edge cases (e.g., "Sloan, MD Mark" → attending: "Mark Sloan, MD")

**Drawbacks:**
- Non-deterministic — same input may produce slightly different output
- Latency: 1-5 seconds per API call
- Cost: $0.01-0.10 per document depending on model and size
- PHI leaves your infrastructure unless using a self-hosted model or BAA-covered API
- Requires validation layer to catch hallucinations

**Best for:** Variable formats, new hospital onboarding, handling messy data.

---

#### Approach C: Hybrid Pipeline (Recommended)

**How it works:** Use rule-based parsing as the primary extractor for known formats. When confidence is low (missing fields, parsing errors, unknown format), fall back to LLM extraction. All results pass through a validation layer before entering the review queue.

```
PDF Upload
    │
    ▼
Text Extraction (pdf-parse)
    │
    ▼
Format Detection ──── Known format? ──── Yes ──→ Rule-Based Parser
    │                                                    │
    No                                                   ▼
    │                                          Confidence Check
    ▼                                           │           │
LLM Extraction ◄─────────────────── Low ◄──────┘    High ──┤
    │                                                       │
    ▼                                                       ▼
Schema Validation ◄────────────────────────────────────────┘
    │
    ▼
Review Queue (with confidence scores per field)
```

**Merits:**
- Fast and cheap for the common case (known PDF formats)
- Graceful degradation for edge cases
- Confidence scoring helps reviewers focus on uncertain fields
- New hospital formats start on LLM path, graduate to rules once stable

**Drawbacks:**
- More complex to implement and maintain
- Need to define confidence thresholds

**This is the approach we implement.**

---

### Validation Layer

Regardless of extraction method, every parsed record passes through:

1. **Schema validation:** Required fields present, types correct
2. **Format validation:** Epic ID matches pattern, phone number format, date parsing
3. **Confidence scoring:** Each field gets a confidence score (1.0 for exact regex match, 0.5-0.9 for LLM extraction)
4. **Duplicate detection:** Check for existing records with same Epic ID + discharge date

### Data Lineage from Ingestion

Every field stores:
- `parsed_value`: The raw extracted value
- `current_value`: The active value (may differ after edits)
- `source`: How it was extracted ("rule_parser_v1", "llm_gpt4", "manual_edit")
- `confidence`: Extraction confidence score

---

## Q3: Scaling the Architecture

### Dimension 1: Volume (1000s of discharges/day)

The current synchronous request-response model works for a rural hospital with 5-20 discharges/day. At 1000+/day:

**Add an async processing queue:**
```
API Gateway → Message Queue (Bull/BullMQ + Redis) → Worker Pool
                                                        │
                                                   ┌────┴────┐
                                                   │ Parser  │
                                                   │ Workers │
                                                   └────┬────┘
                                                        │
                                                   Database + 
                                                   WebSocket notifications
```

- Uploads return immediately with a job ID
- Workers process PDFs in parallel
- WebSocket pushes status updates to the UI
- Horizontal scaling: add more workers behind the queue

**Database migration:** SQLite → PostgreSQL for concurrent writes and row-level locking.

### Dimension 2: Ingestion Adapters

Different hospitals have different technical capabilities. The ingestion layer becomes pluggable:

```typescript
interface IngestionAdapter {
  name: string;
  parse(input: Buffer | string): Promise<DischargeRecord[]>;
  validate(records: DischargeRecord[]): ValidationResult[];
}

// Current
class PdfIngestionAdapter implements IngestionAdapter { ... }

// Future
class Hl7IngestionAdapter implements IngestionAdapter { ... }
class FhirApiAdapter implements IngestionAdapter { ... }
class DirectDbAdapter implements IngestionAdapter { ... }
class CsvIngestionAdapter implements IngestionAdapter { ... }
```

Each adapter normalizes data into the same `DischargeRecord` schema. The review queue, enrichment pipeline, and campaign triggers don't care how the data arrived.

**HL7v2 specifically:** Use a library like `node-hl7-complete` to parse ADT^A03 (discharge) messages. Set up a MLLP listener or consume from an integration engine (Mirth Connect, Rhapsody).

**FHIR API:** RESTful polling or subscription on `Encounter` resources with status `finished`.

### Dimension 3: Partners and Downstream Consumers

As more stakeholders need discharge data (home health agencies, pharmacies, payers):

**Event-driven architecture:**
```
Ingestion → Discharge Created Event → Event Bus
                                         │
                            ┌────────────┼────────────┐
                            ▼            ▼            ▼
                       TCM Campaign  Home Health   Pharmacy
                       Trigger       Referral      Reconciliation
```

- Webhook registration for partners
- Event schema versioning for backward compatibility
- Rate limiting and retry logic per subscriber

### Dimension 4: Multi-Tenancy

Each hospital/health system becomes a tenant:
- Tenant-scoped data isolation
- Per-tenant adapter configuration
- Per-tenant review workflows and approval chains
- Shared infrastructure, isolated data

### What We Don't Build Yet

Following "do more with less" — the current implementation solves the immediate pain (PDF ingestion + review) while the architecture leaves clear extension points. We don't prematurely build the queue, HL7 listener, or event bus — but the adapter pattern and clean separation of concerns mean we can add them without rewriting.

---

## Implementation Notes

### Security Considerations
- PHI handling: all data encrypted at rest, TLS in transit
- Role-based access: only authorized coordinators can review/edit
- Audit logging: every action logged with user, timestamp, IP
- HIPAA: avoid sending PHI to external APIs without BAA

### Error Handling
- Malformed PDFs: return clear error with partial results if possible
- Parser failures: flag for manual entry rather than silently dropping records
- External service failures (Twilio): graceful degradation, enrich later

### Testing Strategy
- Unit tests for parser with known PDF inputs
- Integration tests for API endpoints
- Snapshot tests for PDF parsing (catch regressions)
- E2E tests for the review workflow
