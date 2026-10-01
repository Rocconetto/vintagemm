import { AVAILABILITY_LABEL, RARITY_LABEL } from '../lib/format';
import type { Appraisal } from '../lib/types';

interface Row {
  term: string;
  value: string | null;
  note?: string | null;
}

export function Identification({ appraisal: a }: { appraisal: Appraisal }) {
  const sizeFit = [a.size, a.fit].filter(Boolean).join(' / ') || null;
  const rows: Row[] = [
    { term: 'Brand', value: a.brand, note: a.brandEvidence },
    { term: 'Item', value: a.itemType ?? a.title },
    { term: 'Era', value: a.era, note: a.eraEvidence },
    { term: 'Size / Fit', value: sizeFit, note: a.size ? 'Size as printed on the label' : null },
    {
      term: 'Material',
      value: a.material,
      note: a.materialSource === 'label' ? 'Read from the composition label' : a.materialSource === 'visual' ? 'Visual estimate, no label read' : null,
    },
    { term: 'Rarity', value: a.rarity ? RARITY_LABEL[a.rarity] : null },
    { term: 'Availability', value: a.availability ? AVAILABILITY_LABEL[a.availability] : null },
  ];

  return (
    <section className="ident" aria-labelledby="ident-title">
      <h2 id="ident-title" className="section-title">
        Identification
      </h2>
      <dl className="ident-list">
        {rows.map((row) => (
          <div key={row.term} className={`ident-row${row.value ? '' : ' is-missing'}`}>
            <dt>{row.term}</dt>
            <dd>
              <span className="ident-value">{row.value ?? 'Not determined'}</span>
              {row.value && row.note && <span className="ident-note">{row.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
