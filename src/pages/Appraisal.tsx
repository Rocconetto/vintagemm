import { useEffect, useState } from 'react';
import { deleteAppraisal, getAppraisal, peekAppraisal } from '../lib/archive';
import { useObjectUrl } from '../lib/hooks';
import { Link, useRouter } from '../lib/router';
import { displayName } from '../lib/format';
import type { ArchiveRecord } from '../lib/types';
import { ValueReveal } from '../components/ValueReveal';
import { Identification } from '../components/Identification';
import { VintageDNA } from '../components/VintageDNA';
import { Assessment } from '../components/Assessment';
import { Market } from '../components/Market';
import { TechnicalAssessment } from '../components/TechnicalAssessment';

export function AppraisalPage({ id }: { id: string }) {
  const { navigate } = useRouter();
  const [record, setRecord] = useState<ArchiveRecord | null | undefined>(() => peekAppraisal(id));
  const [confirming, setConfirming] = useState(false);
  const photoUrl = useObjectUrl(record?.photo);

  useEffect(() => {
    if (peekAppraisal(id)) {
      setRecord(peekAppraisal(id));
      return;
    }
    getAppraisal(id)
      .then((r) => setRecord(r ?? null))
      .catch(() => setRecord(null));
  }, [id]);

  useEffect(() => {
    if (record) document.title = `${displayName(record.appraisal)} · VINTAGEM`;
    return () => {
      document.title = 'VINTAGEM';
    };
  }, [record]);

  if (record === undefined) return <main className="appraisal is-loading" id="main" aria-busy="true" />;

  if (record === null) {
    return (
      <main className="page-empty" id="main">
        <h1>This appraisal isn’t in your archive</h1>
        <p>Appraisals are kept on the device that made them. It may have been deleted, or made on another device.</p>
        <div className="error-actions">
          <Link to="/" className="primary-button">
            Scan a piece
          </Link>
          <Link to="/archive" className="text-button">
            Open archive
          </Link>
        </div>
      </main>
    );
  }

  const a = record.appraisal;
  const remove = async () => {
    await deleteAppraisal(record.id);
    navigate('/archive', { replace: true });
  };

  return (
    <main className="appraisal" id="main">
      <figure className="appraisal-photo">
        {photoUrl && <img className="vt-piece" src={photoUrl} alt={`Photo of ${displayName(a)}`} />}
      </figure>

      <article className="appraisal-body">
        <header className="appraisal-head">
          <p className="appraisal-brand">{a.brand ?? 'Brand not identified'}</p>
          <h1 className="appraisal-title">{displayName(a)}</h1>
        </header>

        <ValueReveal appraisal={a} />
        <Identification appraisal={a} />
        <VintageDNA appraisal={a} />
        <Assessment appraisal={a} />
        <Market market={a.market} />
        <TechnicalAssessment appraisal={a} />

        <footer className="appraisal-actions">
          <Link to="/" className="primary-button">
            Scan another piece
          </Link>
          {confirming ? (
            <span className="confirm" role="group" aria-label="Confirm deletion">
              <span>Delete this appraisal?</span>
              <button type="button" className="text-button is-danger" onClick={remove}>
                Delete
              </button>
              <button type="button" className="text-button" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="text-button" onClick={() => setConfirming(true)}>
              Delete appraisal
            </button>
          )}
        </footer>
      </article>
    </main>
  );
}
