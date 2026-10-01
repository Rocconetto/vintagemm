import type { Appraisal } from '../lib/types';

// Qualitative assessment. VINTAGEM does not compute a numeric "vintage score":
// no calibrated data exists to make one honest.
export function Assessment({ appraisal }: { appraisal: Appraisal }) {
  const { condition, positives, concerns, authenticity } = appraisal.assessment;
  const empty = !condition && !positives.length && !concerns.length && !authenticity;

  return (
    <section className="assessment" aria-labelledby="assessment-title">
      <h2 id="assessment-title" className="section-title">
        Assessment
      </h2>
      {empty ? (
        <p className="quiet-empty">No condition or authenticity observations could be made from this photo.</p>
      ) : (
        <>
          {condition && <p className="assessment-lead">{condition}</p>}
          <div className="assessment-cols">
            {positives.length > 0 && (
              <div>
                <h3 className="micro">In its favour</h3>
                <ul className="assessment-list">
                  {positives.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {concerns.length > 0 && (
              <div>
                <h3 className="micro">Check in person</h3>
                <ul className="assessment-list is-concerns">
                  {concerns.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {authenticity && (
            <div className="authenticity">
              <h3 className="micro">Authenticity indicators</h3>
              <p>{authenticity}</p>
              <p className="fine">Observations from one photo, not a certificate of authenticity.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
