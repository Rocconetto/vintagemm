import { useEffect, useState } from 'react';
import { Link, useRouter } from '../lib/router';
import { listAppraisals, subscribe } from '../lib/archive';

export function useArchiveCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const load = () => listAppraisals().then((all) => setCount(all.length)).catch(() => setCount(null));
    load();
    return subscribe(load);
  }, []);
  return count;
}

export function Header() {
  const { path } = useRouter();
  const count = useArchiveCount();
  const onArchive = path === '/archive';

  return (
    <header className="masthead">
      <Link to="/" className="wordmark" aria-label="VINTAGEM, new scan">
        VINTAGEM
      </Link>
      <nav className="masthead-nav" aria-label="Main">
        {path !== '/' && (
          <Link to="/" className="nav-link">
            New scan
          </Link>
        )}
        <Link to="/archive" className="nav-link" aria-current={onArchive ? 'page' : undefined}>
          Archive{count ? <span className="nav-count">{count}</span> : null}
        </Link>
      </nav>
    </header>
  );
}
