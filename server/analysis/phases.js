// Analysis phases, shared by the server and the in-artifact build.
// Each phase is tied to a real event:
// - "scan" completes when the model starts answering about the image;
// - model phases complete as their JSON key actually arrives in the stream;
// - "market" runs only if a market source is connected, otherwise it is reported as skipped.

export const PHASES = [
  { id: 'scan', key: null },
  { id: 'labels', key: 'labels' },
  { id: 'brand', key: 'brand' },
  { id: 'era', key: 'era' },
  { id: 'material', key: 'material' },
  { id: 'rarity', key: 'rarity' },
  { id: 'value', key: 'estimate' },
  { id: 'market', key: null },
];

const MODEL_PHASES = PHASES.slice(0, -1);
const KEY_PATTERNS = MODEL_PHASES.map((p) => (p.key ? new RegExp(`"${p.key}"\\s*:`) : null));

// emit(event, { id, status }) is called only when a phase's status really changes.
export function createPhaseTracker(emit) {
  const status = new Map();
  let furthest = 0;
  let started = false;

  const set = (id, s) => {
    if (status.get(id) === s || status.get(id) === 'done') return;
    status.set(id, s);
    emit('phase', { id, status: s });
  };

  const advanceTo = (index) => {
    if (index <= furthest) return;
    for (let i = 0; i < index; i++) set(MODEL_PHASES[i].id, 'done');
    set(MODEL_PHASES[index].id, 'active');
    furthest = index;
  };

  return {
    set,
    start() {
      set('scan', 'active');
    },
    // Call with the whole model output so far.
    observe(output) {
      if (!started && output) {
        started = true;
        advanceTo(1);
      }
      for (let i = MODEL_PHASES.length - 1; i > 1; i--) {
        if (KEY_PATTERNS[i].test(output)) {
          advanceTo(i);
          break;
        }
      }
    },
    finishModel() {
      for (const p of MODEL_PHASES) set(p.id, 'done');
    },
  };
}
