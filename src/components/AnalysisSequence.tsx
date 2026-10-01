import type { PhaseId, PhaseStatus } from '../lib/types';

export const PHASE_ORDER: PhaseId[] = ['scan', 'labels', 'brand', 'era', 'material', 'rarity', 'value', 'market'];

const LABELS: Record<PhaseId, string> = {
  scan: 'Scanning image',
  labels: 'Reading labels',
  brand: 'Identifying brand',
  era: 'Dating the piece',
  material: 'Analyzing material',
  rarity: 'Assessing rarity',
  value: 'Estimating value',
  market: 'Checking market data',
};

function label(id: PhaseId, status: PhaseStatus) {
  if (id === 'market' && status === 'skipped') return 'No market source connected';
  if (id === 'market' && status === 'failed') return 'Market data unavailable';
  return LABELS[id];
}

// Each phase reflects an event reported by the server; nothing advances on a timer.
export function AnalysisSequence({ phases, onCancel }: { phases: Record<PhaseId, PhaseStatus>; onCancel: () => void }) {
  const active = PHASE_ORDER.find((id) => phases[id] === 'active') ?? (phases.scan === 'pending' ? 'scan' : null);
  const doneCount = PHASE_ORDER.filter((id) => ['done', 'skipped', 'failed'].includes(phases[id])).length;

  return (
    <section className="sequence" aria-label="Appraisal in progress">
      <p className="sequence-now" aria-live="polite" key={active ?? 'finishing'}>
        {active ? LABELS[active] : 'Composing the appraisal'}
      </p>
      <div
        className="sequence-meter"
        role="progressbar"
        aria-label="Appraisal progress"
        aria-valuemin={0}
        aria-valuemax={PHASE_ORDER.length}
        aria-valuenow={doneCount}
      >
        <span style={{ transform: `scaleX(${doneCount / PHASE_ORDER.length})` }} />
      </div>
      <ol className="sequence-list">
        {PHASE_ORDER.map((id) => (
          <li key={id} className={`phase is-${phases[id]}`}>
            <span className="phase-mark" aria-hidden="true" />
            <span className="phase-label">{label(id, phases[id])}</span>
            <span className="visually-hidden">
              {phases[id] === 'done' ? ', done' : phases[id] === 'active' ? ', in progress' : phases[id] === 'pending' ? ', waiting' : ''}
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="text-button sequence-cancel" onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}
