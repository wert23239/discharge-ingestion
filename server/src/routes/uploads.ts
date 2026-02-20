import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { parsePdfBuffer } from '../services/pdfParser';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// POST /api/uploads - Upload and parse a PDF
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported' });
    }

    const uploadedBy = (req.body.uploadedBy as string) || 'anonymous';

    // Create upload record
    const uploadRecord = await prisma.upload.create({
      data: {
        filename: req.file.originalname,
        uploadedBy,
        status: 'PROCESSING',
      },
    });

    try {
      const result = await parsePdfBuffer(req.file.buffer);

      // Create discharge records
      const discharges = await Promise.all(
        result.records.map((record) =>
          prisma.discharge.create({
            data: {
              uploadId: uploadRecord.id,
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
          })
        )
      );

      // Update upload status
      await prisma.upload.update({
        where: { id: uploadRecord.id },
        data: {
          status: 'COMPLETED',
          rawText: result.rawText,
          recordCount: discharges.length,
        },
      });

      return res.status(201).json({
        upload: { ...uploadRecord, status: 'COMPLETED', recordCount: discharges.length },
        discharges,
      });
    } catch (parseError) {
      await prisma.upload.update({
        where: { id: uploadRecord.id },
        data: { status: 'FAILED' },
      });
      throw parseError;
    }
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process upload' });
  }
});

// GET /api/uploads
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const uploads = await prisma.upload.findMany({
    orderBy: { uploadedAt: 'desc' },
    include: { _count: { select: { discharges: true } } },
  });
  res.json(uploads);
}));

// GET /api/uploads/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid upload ID' });
  const uploadRecord = await prisma.upload.findUnique({
    where: { id },
    include: { discharges: { include: { edits: true, enrichments: true } } },
  });

  if (!uploadRecord) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  res.json(uploadRecord);
}));

export default router;
