import { formatDate, shortRef } from '../lib/format';
import type { Appraisal } from '../lib/types';

// The dealer-facing note, set as a catalogue record.
export function TechnicalAssessment({ appraisal: a }: { appraisal: Appraisal }) {
  const paragraphs = a.technicalNote?.split('\n\n') ?? [];

  return (
    <section className="technical" aria-labelledby="technical-title">
      <h2 id="technical-title" className="section-title">
        Technical assessment
      </h2>

      <dl className="record">
        <div>
          <dt>Record</dt>
          <dd>{shortRef(a.id)}</dd>
        </div>
        <div>
          <dt>Appraised</dt>
          <dd>{formatDate(a.createdAt) ?? 'Date unavailable'}</dd>
        </div>
      </dl>

      <div className="technical-body">
        <div className="labels-read">
          <h3 className="micro">Label text read</h3>
          {a.labels.length ? (
            <ul>
              {a.labels.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="quiet-empty">No legible label in this photo.</p>
          )}
        </div>

        <div className="technical-note">
          {paragraphs.length ? (
            paragraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p className="quiet-empty">The analysis didn’t produce a technical note for this piece.</p>
          )}
        </div>
      </div>

      {a.confidence != null && (
        <p className="fine footnote">
          <span aria-hidden="true">* </span>Identification confidence is the analysis’s own rating of how sure it is about the details above. It
          isn’t a measure of authenticity.
        </p>
      )}
    </section>
  );
}
