import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { validatePhone } from '../services/enrichment';

const router = Router();
const prisma = new PrismaClient();

// Async handler wrapper to catch promise rejections
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// GET /api/discharges - List with filters
router.get('/', asyncHandler(async (req, res) => {
  const { status, uploadId, search } = req.query;

  const where: any = {};
  if (status && status !== 'ALL') where.status = status as string;
  if (uploadId) where.uploadId = parseInt(uploadId as string);
  if (search) {
    where.OR = [
      { patientName: { contains: search as string } },
      { epicId: { contains: search as string } },
    ];
  }

  const discharges = await prisma.discharge.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { upload: { select: { filename: true } } },
  });

  res.json(discharges);
}));

// GET /api/discharges/stats — MUST come before /:id
router.get('/stats', asyncHandler(async (_req, res) => {
  const [total, pending, approved, rejected, uploads] = await Promise.all([
    prisma.discharge.count(),
    prisma.discharge.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.discharge.count({ where: { status: 'APPROVED' } }),
    prisma.discharge.count({ where: { status: 'REJECTED' } }),
    prisma.upload.count(),
  ]);

  res.json({ total, pending, approved, rejected, uploads });
}));

// GET /api/discharges/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const discharge = await prisma.discharge.findUnique({
    where: { id },
    include: {
      edits: { orderBy: { editedAt: 'desc' } },
      enrichments: { orderBy: { enrichedAt: 'desc' } },
      upload: { select: { filename: true } },
    },
  });

  if (!discharge) {
    return res.status(404).json({ error: 'Discharge not found' });
  }

  res.json(discharge);
}));

// PATCH /api/discharges/:id - Edit with lineage
router.patch('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { fields, editedBy, reason } = req.body;

  if (!fields || !editedBy) {
    return res.status(400).json({ error: 'fields and editedBy are required' });
  }

  const discharge = await prisma.discharge.findUnique({ where: { id } });
  if (!discharge) {
    return res.status(404).json({ error: 'Discharge not found' });
  }

  // Create edit records for each changed field
  const editPromises = Object.entries(fields).map(([fieldName, newValue]) => {
    const oldValue = (discharge as any)[fieldName];
    if (oldValue === newValue) return null;

    return prisma.dischargeEdit.create({
      data: {
        dischargeId: id,
        fieldName,
        oldValue: oldValue?.toString() ?? '',
        newValue: (newValue as string) ?? '',
        editedBy,
        reason: reason || '',
      },
    });
  });

  await Promise.all(editPromises.filter(Boolean));

  // Update the discharge record
  const updated = await prisma.discharge.update({
    where: { id },
    data: fields,
    include: { edits: { orderBy: { editedAt: 'desc' } }, enrichments: true },
  });

  res.json(updated);
}));

// POST /api/discharges/:id/review
router.post('/:id/review', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, reviewedBy } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
  }

  if (!reviewedBy) {
    return res.status(400).json({ error: 'reviewedBy is required' });
  }

  const discharge = await prisma.discharge.update({
    where: { id },
    data: { status, reviewedBy, reviewedAt: new Date() },
    include: { edits: true, enrichments: true },
  });

  res.json(discharge);
}));

// POST /api/discharges/:id/enrich
router.post('/:id/enrich', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const discharge = await prisma.discharge.findUnique({ where: { id } });

  if (!discharge) {
    return res.status(404).json({ error: 'Discharge not found' });
  }

  const results = [];

  // Phone validation
  if (discharge.phoneNumber) {
    const phoneResult = await validatePhone(discharge.phoneNumber);
    const enrichment = await prisma.enrichment.create({
      data: {
        dischargeId: id,
        fieldName: 'phoneNumber',
        source: 'twilio_lookup',
        result: JSON.stringify(phoneResult),
      },
    });
    results.push(enrichment);
  }

  res.json(results);
}));

export default router;
