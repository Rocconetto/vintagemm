import { useEffect, useMemo, useState } from 'react';
import { clearArchive, listAppraisals, subscribe } from '../lib/archive';
import { Link } from '../lib/router';
import { estimateMid } from '../lib/format';
import type { ArchiveRecord } from '../lib/types';
import { ArchiveTile } from '../components/ArchiveTile';

type Sort = 'newest' | 'oldest' | 'value';

function haystack(r: ArchiveRecord) {
  const a = r.appraisal;
  return [a.brand, a.title, a.itemType, a.category, a.era, a.material, a.origin].filter(Boolean).join(' ').toLowerCase();
}

export function ArchivePage() {
  const [records, setRecords] = useState<ArchiveRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const load = () =>
      listAppraisals()
        .then((r) => {
          setRecords(r);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    load();
    return subscribe(load);
  }, []);

  const visible = useMemo(() => {
    if (!records) return [];
    const q = query.trim().toLowerCase();
    const filtered = q ? records.filter((r) => haystack(r).includes(q)) : [...records];
    if (sort === 'oldest') filtered.reverse();
    if (sort === 'value') filtered.sort((x, y) => estimateMid(y.appraisal) - estimateMid(x.appraisal));
    return filtered;
  }, [records, query, sort]);

  if (failed) {
    return (
      <main className="page-empty" id="main">
        <h1>The archive can’t be opened in this browser</h1>
        <p>Private browsing or blocked site storage prevents VINTAGEM from keeping appraisals on this device.</p>
      </main>
    );
  }

  if (records && records.length === 0) {
    return (
      <main className="page-empty archive-empty" id="main">
        <h1>Your archive starts with one photo</h1>
        <p>Every piece you appraise is kept here, on this device, with its photo, value and notes.</p>
        <div className="error-actions">
          <Link to="/" className="primary-button">
            Scan a piece
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="archive" id="main" aria-busy={records === null}>
      <header className="archive-head">
        <h1 className="archive-title">Archive</h1>
        {records && (
          <p className="archive-count">
            {records.length} {records.length === 1 ? 'piece' : 'pieces'} appraised on this device
          </p>
        )}
      </header>

      {records && records.length > 1 && (
        <div className="archive-tools">
          <label className="search">
            <span className="visually-hidden">Search the archive</span>
            <input type="search" placeholder="Search brand, item, era" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="sort">
            <span className="visually-hidden">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="value">Highest value</option>
            </select>
          </label>
        </div>
      )}

      {records && visible.length === 0 && (
        <p className="quiet-empty archive-nomatch">
          Nothing in the archive matches “{query.trim()}”.{' '}
          <button type="button" className="text-button" onClick={() => setQuery('')}>
            Clear search
          </button>
        </p>
      )}

      <div className="archive-grid">
        {visible.map((r) => (
          <ArchiveTile key={r.id} record={r} />
        ))}
      </div>

      {records && records.length > 0 && (
        <footer className="archive-foot">
          {confirming ? (
            <span className="confirm" role="group" aria-label="Confirm clearing the archive">
              <span>Delete all {records.length} appraisals from this device?</span>
              <button
                type="button"
                className="text-button is-danger"
                onClick={async () => {
                  await clearArchive();
                  setConfirming(false);
                }}
              >
                Delete all
              </button>
              <button type="button" className="text-button" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="text-button" onClick={() => setConfirming(true)}>
              Clear archive
            </button>
          )}
        </footer>
      )}
    </main>
  );
}
