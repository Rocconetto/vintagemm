import { useEffect, useState } from 'react';
import { listAppraisals, subscribe } from '../lib/archive';
import { Link } from '../lib/router';
import type { ArchiveRecord } from '../lib/types';
import { ArchiveTile } from './ArchiveTile';

export function RecentStrip() {
  const [records, setRecords] = useState<ArchiveRecord[]>([]);

  useEffect(() => {
    const load = () => listAppraisals().then(setRecords).catch(() => setRecords([]));
    load();
    return subscribe(load);
  }, []);

  if (!records.length) return null;

  return (
    <section className="recent" aria-labelledby="recent-title">
      <div className="recent-head">
        <h2 id="recent-title">Recently appraised</h2>
        <Link to="/archive" className="nav-link">
          Open archive
        </Link>
      </div>
      <div className="recent-row">
        {records.slice(0, 4).map((r) => (
          <ArchiveTile key={r.id} record={r} compact />
        ))}
      </div>
    </section>
  );
}
