# Kouper Health Challenge — Build Plan

## Understanding the Problem

A rural hospital sends discharge lists as PDFs. We need to:
1. Parse unstructured PDF → structured data
2. Let coordinators review, approve, and edit discharge records
3. Track data lineage (who changed what, when, original vs edited)
4. Enrich data via external services (phone validation, insurance lookup)
5. Design for scale (1000s/day, HL7, API integrations)

## Stack Decision

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** React + TypeScript + Tailwind CSS
- **Database:** SQLite (portable, zero-config, easy to demo) via Prisma ORM
- **PDF Parsing:** pdf-parse (text extraction) + LLM-based structuring OR regex/heuristic parsing
- **Testing:** Vitest (backend), React Testing Library (frontend)

Why this stack:
- Challenge suggests Express + React + RDBMS as acceptable
- TypeScript for safety in healthcare context
- SQLite for easy demo (no external DB needed)
- Prisma for clean migrations and type safety

## Database Schema

### discharges
- id (PK)
- upload_id (FK → uploads)
- patient_name
- epic_id
- phone_number
- attending_physician
- discharge_date
- primary_care_provider
- insurance
- disposition
- status: PENDING_REVIEW | APPROVED | REJECTED | NEEDS_EDIT
- reviewed_by
- reviewed_at
- created_at
- updated_at
- raw_text (original extracted text for this record)

### uploads
- id (PK)
- filename
- uploaded_at
- uploaded_by
- status: PROCESSING | COMPLETED | FAILED
- raw_text (full PDF text)
- record_count

### discharge_edits (data lineage)
- id (PK)
- discharge_id (FK → discharges)
- field_name
- old_value
- new_value
- edited_by
- edited_at
- reason

### enrichments
- id (PK)
- discharge_id (FK → discharges)
- field_name
- source (e.g. "twilio_lookup")
- result (JSON)
- enriched_at

## API Endpoints

### Uploads
- POST /api/uploads — upload PDF, triggers parsing
- GET /api/uploads — list all uploads
- GET /api/uploads/:id — get upload details with records

### Discharges
- GET /api/discharges — list all discharges (filterable by status, upload)
- GET /api/discharges/:id — get single discharge with edits + enrichments
- PATCH /api/discharges/:id — edit fields (creates lineage record)
- POST /api/discharges/:id/review — approve/reject with reviewer info

### Enrichment
- POST /api/discharges/:id/enrich — trigger enrichment for a discharge
- GET /api/discharges/:id/enrichments — get enrichment results

## UI Pages

1. **Dashboard** — overview of uploads, pending reviews count
2. **Upload** — drag-and-drop PDF upload with preview
3. **Review Queue** — list of pending discharges, click to review
4. **Discharge Detail** — view parsed data, edit fields, see lineage, approve/reject
5. **Upload Detail** — see all records from a specific upload

## PDF Parsing Strategy

For Q1 tech spec, I'll describe multiple approaches:
1. **Regex/heuristic parsing** — pattern match on known PDF structure
2. **LLM-based extraction** — send text to GPT/Claude to extract structured data
3. **Hybrid** — heuristic first, LLM fallback for ambiguous cases

For implementation: Use heuristic parsing since the PDF has a known structure (table with headers). This is deterministic, fast, and doesn't require external API calls.

## Data Lineage

Every edit creates an audit trail:
- Original parsed value preserved
- Each edit records: who, when, old value, new value, reason
- UI shows edit history timeline per field

## Enrichment

- Phone validation: Twilio Lookup API (or mock if no API key)
- Show enrichment results in review UI
- Flag suspicious data (invalid phone, etc.)

## Scalability (Q3)

The tech spec will address:
- Pluggable ingestion adapters (PDF, HL7, API, DB read)
- Message queue for async processing at scale
- Webhook/event system for partners
- Microservice extraction path

## Build Order

1. ✅ Create repo
2. [ ] Write tech spec document (Q1 + Q3)
3. [ ] Set up project structure (monorepo: /server + /client)
4. [ ] Database schema + Prisma setup
5. [ ] PDF parser module
6. [ ] API endpoints
7. [ ] React frontend scaffolding
8. [ ] Upload flow UI
9. [ ] Review queue UI
10. [ ] Discharge detail + edit UI with lineage
11. [ ] Enrichment integration (Twilio mock)
12. [ ] Polish UI (Tailwind, responsive, clean)
13. [ ] Testing
14. [ ] README with setup instructions
15. [ ] Deploy or document deployment
