import { Header } from './components/Header';
import { Router, Link, useRouter } from './lib/router';
import { Home } from './pages/Home';
import { AppraisalPage } from './pages/Appraisal';
import { ArchivePage } from './pages/Archive';

function Screen() {
  const { path } = useRouter();
  if (path === '/') return <Home />;
  if (path === '/archive') return <ArchivePage />;
  const match = /^\/appraisal\/([\w-]+)\/?$/.exec(path);
  if (match) return <AppraisalPage key={match[1]} id={match[1]} />;
  return (
    <main className="page-empty" id="main">
      <h1>There’s nothing at this address</h1>
      <p>The link may be mistyped, or the page has moved.</p>
      <div className="error-actions">
        <Link to="/" className="primary-button">
          Scan a piece
        </Link>
      </div>
    </main>
  );
}

export function App() {
  return (
    <Router>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <Screen />
    </Router>
  );
}
