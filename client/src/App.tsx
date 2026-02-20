import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import ReviewQueue from './pages/ReviewQueue';
import DischargeDetail from './pages/DischargeDetail';
import UploadDetail from './pages/UploadDetail';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/discharges/:id" element={<DischargeDetail />} />
          <Route path="/uploads/:id" element={<UploadDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
