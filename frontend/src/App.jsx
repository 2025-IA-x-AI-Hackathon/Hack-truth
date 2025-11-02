import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import ShareResultPage from './pages/ShareResultPage.jsx';

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const shareId = new URLSearchParams(location.search).get('id');
  const isLanding = location.pathname === '/' || location.pathname === '';
  const [lastSharePath, setLastSharePath] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('hacktruth:lastShareUrl');
    if (stored) {
      setLastSharePath(stored);
    } else {
      setLastSharePath(null);
    }
  }, [location.key]);

  if (isLanding && shareId) {
    return <Navigate to={`/share?id=${shareId}`} replace />;
  }

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <div className="app-shell__branding">
            <Link to="/" className="app-shell__brand-link">
              <span className="app-shell__brand">HackTruth</span>
              <span className="app-shell__subtitle">Fact Check Companion</span>
            </Link>
          </div>
          <nav className="app-shell__nav" aria-label="주요 페이지">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `app-shell__nav-link ${isActive ? 'app-shell__nav-link--active' : ''}`
              }
              end
            >
              HackTruth 소개 페이지
            </NavLink>
            {lastSharePath && !location.pathname.startsWith('/share') && (
              <button
                type="button"
                className="app-shell__nav-link app-shell__nav-link--cta"
                onClick={() => navigate(lastSharePath)}
              >
                Fact Check 결과로 돌아가기
              </button>
            )}
            <a
              href="https://github.com/2025-IA-x-AI-Hackathon/Hack-truth"
              className="landing__cta landing__cta--ghost"
              target="_blank"
              rel="noreferrer"
            >
              github repo 보기
            </a>
          </nav>
        </div>
      </header>

      <main className={isLanding ? 'app-shell__main app-shell__main--landing' : 'app-shell__main'}>
        <Outlet />
      </main>

      <footer className="app-shell__footer">
        <p>HackTruth © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="share" element={<ShareResultPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
