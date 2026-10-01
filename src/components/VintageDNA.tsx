import { useEffect, useRef, useState } from 'react';
import { dnaTokens } from '../lib/format';
import { usePrefersReducedMotion } from '../lib/hooks';
import type { Appraisal } from '../lib/types';

// Vintage DNA: the piece's established attributes, set like a woven garment label.
export function VintageDNA({ appraisal }: { appraisal: Appraisal }) {
  const tokens = dnaTokens(appraisal);
  const era = tokens.find((t) => t.kind === 'era');
  const rest = tokens.filter((t) => t.kind !== 'era');
  const section = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  // The label "weaves" in once, when it scrolls into view. Without observer support it is simply shown.
  const [phase, setPhase] = useState<'static' | 'hidden' | 'revealed'>(() =>
    !reduced && 'IntersectionObserver' in window ? 'hidden' : 'static',
  );

  useEffect(() => {
    if (phase !== 'hidden' || !section.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('revealed');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -25% 0px' },
    );
    io.observe(section.current); // the section, not the clipped label: a clipped box never intersects
    return () => io.disconnect();
  }, [phase]);

  return (
    <section ref={section} className="dna" aria-labelledby="dna-title">
      <h2 id="dna-title" className="section-title">
        Vintage DNA
      </h2>
      {tokens.length >= 2 ? (
        <figure className={`dna-label is-${phase}`}>
          <div className="dna-weave" aria-hidden="true" />
          <div className="dna-content">
            {appraisal.brand && <p className="dna-brand">{appraisal.brand}</p>}
            {era && <p className="dna-era">{era.label}</p>}
            <ul className="dna-tokens">
              {rest.map((t) => (
                <li key={t.kind} className={`dna-token is-${t.kind}`}>
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
          <figcaption className="visually-hidden">
            {[appraisal.brand, ...tokens.map((t) => t.label)].filter(Boolean).join(', ')}
          </figcaption>
        </figure>
      ) : (
        <p className="quiet-empty">
          The photo didn’t establish enough attributes to compose this piece’s DNA. A shot of the inner label usually adds era, origin and
          material.
        </p>
      )}
    </section>
  );
}
