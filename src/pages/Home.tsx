import { useCallback, useEffect, useRef, useState } from 'react';
import { Scanner } from '../components/Scanner';
import { AnalysisSequence, PHASE_ORDER } from '../components/AnalysisSequence';
import { ErrorState } from '../components/ErrorState';
import { RecentStrip } from '../components/RecentStrip';
import { analyze, AnalysisFailure, fetchConfig } from '../lib/api';
import { preparePhoto, PhotoError, type PreparedPhoto } from '../lib/image';
import { saveAppraisal } from '../lib/archive';
import { useRouter } from '../lib/router';
import type { AnalysisErrorCode, PhaseId, PhaseStatus, ServerConfig } from '../lib/types';

type Phases = Record<PhaseId, PhaseStatus>;
const freshPhases = (): Phases => Object.fromEntries(PHASE_ORDER.map((id) => [id, 'pending'])) as Phases;

type State =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'ready'; photo: PreparedPhoto }
  | { kind: 'analyzing'; photo: PreparedPhoto; phases: Phases }
  | { kind: 'error'; photo: PreparedPhoto | null; code: AnalysisErrorCode };

export function Home() {
  const { navigate } = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const photo = 'photo' in state ? state.photo : null;

  useEffect(() => {
    fetchConfig().then(setConfig);
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo.photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // Keep the progress or the error in view, especially on small screens.
  useEffect(() => {
    if (state.kind !== 'analyzing' && state.kind !== 'error') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }));
  }, [state.kind]);

  const onFile = useCallback(async (file: File) => {
    setState({ kind: 'preparing' });
    try {
      setState({ kind: 'ready', photo: await preparePhoto(file) });
    } catch (error) {
      if (!(error instanceof PhotoError)) console.error(error);
      setState({ kind: 'error', photo: null, code: 'invalid_image' });
    }
  }, []);

  const start = async (prepared: PreparedPhoto) => {
    const controller = new AbortController();
    abort.current = controller;
    let phases = freshPhases();
    setState({ kind: 'analyzing', photo: prepared, phases });
    try {
      const appraisal = await analyze(
        prepared,
        (id, status) => {
          phases = { ...phases, [id]: status };
          setState((s) => (s.kind === 'analyzing' ? { ...s, phases } : s));
        },
        controller.signal,
      );
      await saveAppraisal(appraisal, prepared.photo, prepared.thumb);
      navigate(`/appraisal/${appraisal.id}`);
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = error instanceof AnalysisFailure ? error.code : 'internal';
      if (!(error instanceof AnalysisFailure)) console.error(error);
      setState({ kind: 'error', photo: prepared, code });
    }
  };

  const cancel = () => {
    abort.current?.abort();
    if (photo) setState({ kind: 'ready', photo });
  };

  const reset = () => setState({ kind: 'idle' });
  const analyzing = state.kind === 'analyzing';
  const offline = config && !config.analysis.available;

  return (
    <main className={`home is-${state.kind}`} id="main">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="hero-title">
          <span className="line">Know what</span> <span className="line">you found.</span>
        </h1>
        <p className="hero-sub">AI-powered vintage identification &amp; market intelligence.</p>
      </section>

      <section className="stage" aria-label="Vintage scanner">
        <Scanner photoUrl={photoUrl} busy={state.kind === 'preparing'} analyzing={analyzing} onFile={onFile} onClear={reset} />

        <div className="stage-panel" ref={panel}>
          {state.kind === 'ready' && (
            <div className="cta-dock">
              <button type="button" className="primary-button cta" onClick={() => start(state.photo)}>
                Analyze item
              </button>
            </div>
          )}
          {state.kind === 'analyzing' && <AnalysisSequence phases={state.phases} onCancel={cancel} />}
          {state.kind === 'error' && (
            <ErrorState
              code={state.code}
              onRetry={() => (state.photo ? start(state.photo) : reset())}
              onRetake={reset}
              onBack={() => (state.photo ? setState({ kind: 'ready', photo: state.photo }) : reset())}
            />
          )}
          {offline && state.kind !== 'analyzing' && state.kind !== 'error' && (
            <p className="engine-note">AI analysis is temporarily unavailable.</p>
          )}
        </div>
      </section>

      {!analyzing && <RecentStrip />}
    </main>
  );
}
