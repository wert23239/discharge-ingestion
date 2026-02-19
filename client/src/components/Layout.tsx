import { Link, useLocation } from 'react-router-dom';

const nav = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/upload', label: 'Upload', icon: '📤' },
  { to: '/review', label: 'Review Queue', icon: '📋' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Skip to main content for keyboard users */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-teal-600 focus:text-white">
        Skip to main content
      </a>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0" aria-label="Main navigation">
        <div className="p-6 border-b border-slate-200">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg font-bold">K</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Discharge Manager</h1>
              <p className="text-xs text-slate-500">Discharge Manager</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => {
            const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <p className="text-xs text-slate-400">v1.0.0 • Sacred Heart Hospital</p>
        </div>
      </aside>

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto" role="main">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
