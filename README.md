# Kouper Health — Discharge Ingestion Platform

A full-stack application for ingesting, reviewing, and managing hospital discharge records from PDF files. Built for the Kouper Health Full-Stack Challenge.

## 🏥 Overview

Rural hospitals often export daily discharge lists as PDFs from their EHR systems. This platform:

1. **Parses** unstructured PDF discharge lists into structured data
2. **Reviews** — coordinators can review, edit, approve, or reject records
3. **Tracks lineage** — every edit creates an audit trail (who, when, what changed, why)
4. **Enriches** data via external services (phone validation via mock Twilio)
5. **Designed for scale** — architecture supports 1000s of records/day, HL7, and API integrations

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Express + TypeScript + Prisma ORM |
| Database | SQLite (zero-config, portable) |
| Client | React + TypeScript + Vite + Tailwind CSS |
| PDF Parsing | pdf-parse + custom heuristic parser |
| Testing | Vitest |

## 🚀 Live Demo

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/wert23239/kouper-health-challenge)

Click the button above to deploy instantly on Render (free tier). Or run locally:

## 🚀 Quick Start

```bash
# Install dependencies
npm install
cd server && npm install
cd ../client && npm install
cd ..

# Setup database
cd server
npx prisma generate
npx prisma db push
cd ..

# Run (starts both server on :3001 and client on :5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

The database auto-seeds with sample data from Sacred Heart Hospital on first run.

## 📁 Project Structure

```
├── server/                    # Express API
│   ├── prisma/schema.prisma   # Database schema
│   ├── src/
│   │   ├── index.ts           # App entry + auto-seed
│   │   ├── seed.ts            # Manual seed script
│   │   ├── routes/
│   │   │   ├── uploads.ts     # Upload endpoints
│   │   │   └── discharges.ts  # Discharge CRUD + review + enrich
│   │   └── services/
│   │       ├── pdfParser.ts   # PDF text → structured records
│   │       └── enrichment.ts  # Mock Twilio phone validation
│   └── tests/
│       └── pdfParser.test.ts  # Parser unit tests
├── client/                    # React SPA
│   └── src/
│       ├── pages/             # Dashboard, Upload, ReviewQueue, etc.
│       ├── components/        # Layout, StatusBadge, ConfidenceBadge
│       ├── lib/api.ts         # API client
│       └── types/             # TypeScript interfaces
├── sample-data/               # Sample discharge PDF
└── docs/TECH_SPEC.md          # Technical specification (Q1 + Q3)
```

## 🔌 API Documentation

### Uploads

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/uploads` | Upload PDF (multipart form, field: `file`) |
| `GET` | `/api/uploads` | List all uploads |
| `GET` | `/api/uploads/:id` | Get upload with discharge records |

### Discharges

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/discharges` | List discharges (query: `status`, `uploadId`, `search`) |
| `GET` | `/api/discharges/stats` | Aggregate counts |
| `GET` | `/api/discharges/:id` | Get discharge with edits + enrichments |
| `PATCH` | `/api/discharges/:id` | Edit fields with lineage tracking |
| `POST` | `/api/discharges/:id/review` | Approve or reject |
| `POST` | `/api/discharges/:id/enrich` | Trigger phone validation |

### Edit with Lineage

```bash
curl -X PATCH http://localhost:3001/api/discharges/1 \
  -H "Content-Type: application/json" \
  -d '{"fields": {"phoneNumber": "202-555-0199"}, "editedBy": "Jane", "reason": "Patient called with updated number"}'
```

Every edit creates an audit record with the old value, new value, editor, timestamp, and reason.

## 🔍 PDF Parser

The parser handles messy real-world data:
- **Varied phone formats**: `202-555-0152`, `4047271234`, `(missing)` → normalized to `XXX-XXX-XXXX`
- **Misplaced credentials**: `Sloan, MD Mark` → `Sloan, Mark MD`
- **Missing fields**: `(missing)` → `null` with reduced confidence score
- **Special characters**: `O'Furniture, Patty` parsed correctly
- **Confidence scoring**: Each record gets 0-1 score based on field completeness and parse quality

## 📐 Architecture Decisions

### Q1: PDF → Structured Data (see [TECH_SPEC.md](docs/TECH_SPEC.md))

We implement a **hybrid parsing approach**:
- Rule-based heuristic parsing for known PDF formats (fast, deterministic, no external APIs)
- Confidence scoring per field to flag uncertain extractions
- Human review queue for all parsed records
- Full data lineage from ingestion through approval

### Q3: Scaling to 1000s/day (see [TECH_SPEC.md](docs/TECH_SPEC.md))

The architecture is designed for extension:
- **Pluggable ingestion adapters** (PDF, HL7, FHIR, CSV, direct DB)
- **Async processing queue** (Bull/Redis) for parallel PDF processing
- **Event-driven architecture** for downstream consumers (home health, pharmacy, payers)
- **Multi-tenancy** for per-hospital configuration
- SQLite → PostgreSQL migration path for concurrent writes

## 🧪 Testing

```bash
cd server && npm test
```

Tests cover:
- Hospital name and date extraction
- All 4 sample records parsed correctly
- Phone normalization (dashes, raw digits, missing)
- Provider credential reordering
- Confidence scoring
- Edge cases (empty input, header-only)

## 🎨 UI Features

- **Dashboard**: Stats cards, recent uploads
- **Upload**: Drag-and-drop PDF upload with processing feedback
- **Review Queue**: Filterable/sortable table with status tabs and search
- **Discharge Detail**: Inline editing with reason tracking, edit history timeline, enrichment badges, approve/reject workflow
- **Healthcare-grade design**: Clean white backgrounds, teal accents, proper typography hierarchy, responsive layout
