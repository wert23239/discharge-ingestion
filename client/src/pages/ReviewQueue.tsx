import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useDebounce } from '../hooks/useDebounce';
import type { Discharge } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfidenceBadge from '../components/ConfidenceBadge';

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING_REVIEW', label: 'Pending' },
  { key: 'NEEDS_EDIT', label: 'Needs Edit' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

export default function ReviewQueue() {
  const [discharges, setDischarges] = useState<Discharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [sortField, setSortField] = useState<'patientName' | 'confidence' | 'dischargeDate'>('patientName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    setLoading(true);
    api.getDischarges({ status: tab === 'ALL' ? undefined : tab, search: debouncedSearch || undefined })
      .then(setDischarges)
      .finally(() => setLoading(false));
  }, [tab, debouncedSearch]);

  const sorted = [...discharges].sort((a, b) => {
    const av = a[sortField] ?? '';
    const bv = b[sortField] ?? '';
    const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    sortField === field ? <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span> : null
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Review Queue</h1>
        <p className="text-slate-500 mt-1">Review and approve parsed discharge records</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex bg-white rounded-lg border border-slate-200 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by name or Epic ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">No discharge records found</p>
            <p className="text-sm mt-1">Upload a PDF to populate the review queue</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-sm text-slate-500 bg-slate-50">
                <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => toggleSort('patientName')}>
                  Patient <SortIcon field="patientName" />
                </th>
                <th className="px-6 py-3 font-medium">Epic ID</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Disposition</th>
                <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => toggleSort('confidence')}>
                  Confidence <SortIcon field="confidence" />
                </th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr
                  key={d.id}
                  className={`border-b border-slate-100 hover:bg-teal-50/30 transition-colors ${
                    i % 2 === 1 ? 'bg-slate-50/50' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <Link to={`/discharges/${d.id}`} className="text-teal-600 hover:text-teal-700 font-medium">
                      {d.patientName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">{d.epicId}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{d.phoneNumber || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{d.disposition}</td>
                  <td className="px-6 py-4"><ConfidenceBadge confidence={d.confidence} /></td>
                  <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
