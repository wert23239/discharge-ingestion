import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import uploadRoutes from './routes/uploads';
import dischargeRoutes from './routes/discharges';
import { PrismaClient } from '@prisma/client';
import { parseDischargeText, parsePdfBuffer } from './services/pdfParser';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/uploads', uploadRoutes);
app.use('/api/discharges', dischargeRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Auto-seed on first run
async function autoSeed() {
  const count = await prisma.upload.count();
  if (count === 0) {
    console.log('No data found. Auto-seeding...');
    // Try to parse the actual PDF first, fall back to inline text
    const samplePdfPath = path.join(__dirname, '../../sample-data/Sacred.Heart.Hospital.Discharges.pdf');
    let result;
    if (fs.existsSync(samplePdfPath)) {
      const pdfBuffer = fs.readFileSync(samplePdfPath);
      result = await parsePdfBuffer(pdfBuffer);
    } else {
      // Fallback: inline sample data
      const SAMPLE_TEXT = `Sacred Heart Hospital Discharges for July 4th, 2023
Sunshine, MelodyEP001234567202-555-0152Kildare, James MD07-04-2023Bailey, Miranda MDBCBSHome
O'Furniture, Patty EP001239901202-555-0148Hardy, Steve MD07-04-2023Webber, Richard MDAetna HealthHHS
Bacon, Chris P.EP0012376544047271234Manning, Steward Wallace PA07-04-2023Sloan, MD Mark Self PaySNF
Mellow, S. Marsha BayabygirlEP001239876House, Greg MD07-04-2023Humana HealthHome`;
      result = parseDischargeText(SAMPLE_TEXT);
    }
    const upload = await prisma.upload.create({
      data: {
        filename: 'Sacred.Heart.Hospital.Discharges.pdf',
        uploadedBy: 'system',
        status: 'COMPLETED',
        rawText: result.rawText,
        recordCount: result.records.length,
      },
    });

    for (const record of result.records) {
      await prisma.discharge.create({
        data: {
          uploadId: upload.id,
          patientName: record.patientName,
          epicId: record.epicId,
          phoneNumber: record.phoneNumber,
          attendingPhysician: record.attendingPhysician,
          dischargeDate: record.dischargeDate,
          primaryCareProvider: record.primaryCareProvider,
          insurance: record.insurance,
          disposition: record.disposition,
          confidence: record.confidence,
          rawText: record.rawText,
          status: 'PENDING_REVIEW',
        },
      });
    }
    console.log(`✅ Auto-seeded ${result.records.length} records`);
  }
}

app.listen(PORT, async () => {
  console.log(`🏥 Kouper Health Server running on http://localhost:${PORT}`);
  await autoSeed();
});

export default app;
