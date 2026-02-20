import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Discharge } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfidenceBadge from '../components/ConfidenceBadge';
import toast from 'react-hot-toast';

const EDITABLE_FIELDS = [
  { key: 'patientName', label: 'Patient Name' },
  { key: 'epicId', label: 'Epic ID' },
  { key: 'phoneNumber', label: 'Phone Number' },
  { key: 'attendingPhysician', label: 'Attending Physician' },
  { key: 'dischargeDate', label: 'Discharge Date' },
  { key: 'primaryCareProvider', label: 'Primary Care Provider' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'disposition', label: 'Disposition' },
];

export default function DischargeDetail() {
  const { id } = useParams<{ id: string }>();
  const [discharge, setDischarge] = useState<Discharge | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [enriching, setEnriching] = useState(false);

  const load = () => {
    setLoading(true);
    api.getDischarge(Number(id)).then(setDischarge).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading || !discharge) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  const startEdit = (field: string) => {
    setEditing(field);
    setEditValue((discharge as any)[field] || '');
    setEditReason('');
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const updated = await api.editDischarge(Number(id), { [editing]: editValue }, 'Coordinator', editReason);
      setDischarge(updated);
      setEditing(null);
      toast.success('Field updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewerName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    try {
      const updated = await api.reviewDischarge(Number(id), status, reviewerName);
      setDischarge(updated);
      toast.success(status === 'APPROVED' ? 'Discharge approved ✓' : 'Discharge rejected');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      await api.enrichDischarge(Number(id));
      load();
      toast.success('Enrichment complete');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link to="/review" className="text-slate-400 hover:text-slate-600">← Back</Link>
        <h1 className="text-2xl font-bold text-slate-800">{discharge.patientName}</h1>
        <StatusBadge status={discharge.status} />
        <ConfidenceBadge confidence={discharge.confidence} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Info */}
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Patient Information</h2>
          <div className="space-y-4">
            {EDITABLE_FIELDS.map((field) => {
              const value = (discharge as any)[field.key];
              const isEditing = editing === field.key;

              return (
                <div key={field.key} className="flex items-start gap-4 py-2 border-b border-slate-100 last:border-0">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium text-slate-500">{field.label}</p>
                  </div>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="input"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          placeholder="Reason for change (optional)"
                          className="input text-sm"
                        />
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="btn-primary text-sm py-1">Save</button>
                          <button onClick={() => setEditing(null)} className="btn-secondary text-sm py-1">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-slate-800">{value || <span className="text-slate-400 italic">Missing</span>}</p>
                        {(discharge.status === 'PENDING_REVIEW' || discharge.status === 'NEEDS_EDIT') && (
                          <button
                            onClick={() => startEdit(field.key)}
                            className="text-slate-400 hover:text-teal-600 transition-colors"
                            title="Edit"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions sidebar */}
        <div className="space-y-6">
          {/* Review Actions */}
          {(discharge.status === 'PENDING_REVIEW' || discharge.status === 'NEEDS_EDIT') && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Review</h3>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Your name"
                className="input mb-4"
              />
              <div className="flex flex-col gap-2">
                <div className="flex gap-3">
                  <button onClick={() => handleReview('APPROVED')} className="btn-primary flex-1">
                    ✓ Approve
                  </button>
                  <button onClick={() => handleReview('REJECTED')} className="btn-danger flex-1">
                    ✗ Reject
                  </button>
                </div>
                <button onClick={() => handleReview('NEEDS_EDIT' as any)} className="btn-secondary w-full text-sm">
                  ✏️ Needs Edit
                </button>
              </div>
            </div>
          )}

          {discharge.status !== 'PENDING_REVIEW' && discharge.status !== 'NEEDS_EDIT' && discharge.reviewedBy && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Review Decision</h3>
              <p className="text-sm text-slate-600">
                <StatusBadge status={discharge.status} /> by <strong>{discharge.reviewedBy}</strong>
              </p>
              {discharge.reviewedAt && (
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(discharge.reviewedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Enrichment */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Enrichment</h3>
            <button onClick={handleEnrich} disabled={enriching} className="btn-secondary w-full mb-4">
              {enriching ? 'Enriching...' : '🔍 Validate Phone'}
            </button>

            {discharge.enrichments && discharge.enrichments.length > 0 && (
              <div className="space-y-3">
                {discharge.enrichments.map((e) => {
                  const result = JSON.parse(e.result);
                  const icon = result.type === 'mobile' ? '✅' : result.type === 'landline' ? '⚠️' : result.type === 'invalid' ? '❌' : '❓';
                  const label = result.type === 'mobile' ? 'Valid Mobile' : result.type === 'landline' ? 'Landline' : result.type === 'invalid' ? 'Invalid' : 'Unknown';
                  const color = result.type === 'mobile' ? 'text-emerald-700 bg-emerald-50' : result.type === 'landline' ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';

                  return (
                    <div key={e.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${color}`}>
                      <span>{icon}</span>
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        {result.carrier && <p className="text-xs opacity-75">{result.carrier}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Source */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Source</h3>
            <p className="text-sm text-slate-600">Upload: <Link to={`/uploads/${discharge.uploadId}`} className="text-teal-600 hover:underline">{discharge.upload?.filename}</Link></p>
            {discharge.rawText && (
              <pre className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 overflow-x-auto">
                {discharge.rawText}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Edit History */}
      {discharge.edits && discharge.edits.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Edit History</h2>
          <div className="space-y-4">
            {discharge.edits.map((edit) => (
              <div key={edit.id} className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0">
                <div className="w-2 h-2 rounded-full bg-teal-500 mt-2 shrink-0" />
                <div>
                  <p className="text-sm text-slate-800">
                    <strong>{edit.editedBy}</strong> changed <code className="bg-slate-100 px-1 rounded text-xs">{edit.fieldName}</code>
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    <span className="line-through text-red-400">{edit.oldValue || '(empty)'}</span>
                    {' → '}
                    <span className="text-emerald-600">{edit.newValue || '(empty)'}</span>
                  </p>
                  {edit.reason && <p className="text-xs text-slate-400 mt-0.5 italic">"{edit.reason}"</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(edit.editedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
