import { useEffect, useRef } from 'react';
import { errorCopy } from '../lib/errors';
import type { AnalysisErrorCode } from '../lib/types';

interface Props {
  code: AnalysisErrorCode;
  onRetry: () => void;
  onRetake: () => void;
  onBack: () => void;
}

export function ErrorState({ code, onRetry, onRetake, onBack }: Props) {
  const copy = errorCopy(code);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [code]);

  return (
    <section className="error-state" role="alert">
      <h2 ref={heading} tabIndex={-1}>
        {copy.title}
      </h2>
      <p>{copy.body}</p>
      <div className="error-actions">
        {copy.action === 'back' ? (
          <button type="button" className="text-button" onClick={onBack}>
            Back to the photo
          </button>
        ) : copy.action === 'retake' ? (
          <button type="button" className="primary-button" onClick={onRetake}>
            Try another photo
          </button>
        ) : (
          <>
            <button type="button" className="primary-button" onClick={onRetry}>
              Try again
            </button>
            <button type="button" className="text-button" onClick={onRetake}>
              Use another photo
            </button>
          </>
        )}
      </div>
    </section>
  );
}
