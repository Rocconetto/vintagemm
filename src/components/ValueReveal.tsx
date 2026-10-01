import { useEffect, useState } from 'react';
import { formatMoney } from '../lib/format';
import { usePrefersReducedMotion } from '../lib/hooks';
import type { Appraisal } from '../lib/types';

function useCountUp(target: number, delay: number, reduced: boolean) {
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    let frame = 0;
    const duration = 1100;
    const startAt = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - startAt) / duration));
      setValue(Math.round(target * (1 - Math.pow(1 - t, 4))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, delay, reduced]);
  return value;
}

export function ValueReveal({ appraisal }: { appraisal: Appraisal }) {
  const reduced = usePrefersReducedMotion();
  const e = appraisal.estimate;
  const low = useCountUp(e?.value ?? e?.low ?? 0, 250, reduced);
  const high = useCountUp(e?.high ?? 0, 380, reduced);

  return (
    <section className="value" aria-labelledby="value-title">
      <h2 id="value-title" className="micro">
        Estimated market value
      </h2>
      {e ? (
        <p className={`value-figure${e.value == null ? ' is-range' : ''}`} aria-label={e.value != null ? formatMoney(e.value) : `${formatMoney(e.low)} to ${formatMoney(e.high)}`}>
          <span aria-hidden="true">{formatMoney(low)}</span>
          {e.value == null && (
            <>
              <span className="value-dash" aria-hidden="true">–</span>
              <span aria-hidden="true">{formatMoney(high)}</span>
            </>
          )}
        </p>
      ) : (
        <p className="value-missing">No responsible estimate from this photo.</p>
      )}
      <div className="value-foot">
        {e && <span>{e.value == null ? 'Resale range in the condition shown' : 'Resale value in the condition shown'}</span>}
        {appraisal.confidence != null && (
          <span className="confidence">
            <span className="confidence-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${appraisal.confidence / 100})` }} />
            </span>
            <span>
              {appraisal.confidence}% identification confidence<span className="footnote-mark" aria-hidden="true">*</span>
            </span>
          </span>
        )}
      </div>
    </section>
  );
}
