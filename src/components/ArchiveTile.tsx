import type { MouseEvent } from 'react';
import { useObjectUrl } from '../lib/hooks';
import { Link } from '../lib/router';
import { displayName, estimateText, formatDate } from '../lib/format';
import type { ArchiveRecord } from '../lib/types';

// One archived appraisal, presented like a catalogue plate.
export function ArchiveTile({ record, compact = false }: { record: ArchiveRecord; compact?: boolean }) {
  const url = useObjectUrl(record.thumb);
  const a = record.appraisal;
  const value = estimateText(a);
  const name = displayName(a);

  const markForTransition = (event: MouseEvent<HTMLAnchorElement>) => {
    const img = event.currentTarget.querySelector('img');
    if (img) img.style.viewTransitionName = 'piece';
  };

  return (
    <Link to={`/appraisal/${record.id}`} className={`tile${compact ? ' is-compact' : ''}`} onClick={markForTransition}>
      <span className="tile-photo">
        {url && <img src={url} alt={name} loading="lazy" decoding="async" />}
      </span>
      <span className="tile-caption">
        <span className="tile-brand">{a.brand ?? 'Brand not identified'}</span>
        <span className="tile-name">{name}</span>
        {!compact && (
          <span className="tile-meta">
            <span className="tile-value">{value ?? 'No estimate'}</span>
            <span className="tile-date">{[a.era, formatDate(record.createdAt)].filter(Boolean).join(', ')}</span>
          </span>
        )}
      </span>
    </Link>
  );
}
