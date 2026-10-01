import type { AnalysisErrorCode } from './types';

export class AnalysisFailure extends Error {
  code: AnalysisErrorCode;
  constructor(code: AnalysisErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// What each failure means for the person holding the garment, and what to do next.
export interface ErrorCopy {
  title: string;
  body: string;
  action: 'retake' | 'retry' | 'back';
}

export function errorCopy(code: AnalysisErrorCode): ErrorCopy {
  switch (code) {
    case 'unrecognized':
      return {
        title: 'We couldn’t identify this piece',
        body: 'Try another photo showing the label, stitching or the full garment, in even light.',
        action: 'retake',
      };
    case 'invalid_image':
      return { title: 'This photo can’t be read', body: 'Use a JPEG, PNG or WebP photo taken with your camera.', action: 'retake' };
    case 'image_too_large':
      return { title: 'This photo is too large', body: 'Choose a smaller photo or take a new one.', action: 'retake' };
    case 'not_connected':
    case 'provider_auth':
      return {
        title: 'AI analysis is temporarily unavailable',
        body: 'Nothing was analyzed and your photo wasn’t stored. Try again later.',
        action: 'back',
      };
    case 'rate_limited':
      return { title: 'Too many appraisals in a row', body: 'Wait a few minutes, then try again.', action: 'retry' };
    case 'timeout':
      return { title: 'The appraisal took too long', body: 'The analysis didn’t finish in time. Try again.', action: 'retry' };
    case 'network':
      return { title: 'Connection lost', body: 'Check your connection, then try again.', action: 'retry' };
    case 'provider_busy':
      return { title: 'VINTAGEM is busy right now', body: 'Try again in a minute.', action: 'retry' };
    case 'invalid_output':
      return { title: 'The appraisal came back incomplete', body: 'Try again. A clearer photo often helps.', action: 'retry' };
    default:
      return { title: 'The appraisal didn’t finish', body: 'Something went wrong on our side. Try again.', action: 'retry' };
  }
}
