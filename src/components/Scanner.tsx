import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';

interface ScannerProps {
  photoUrl: string | null;
  busy: boolean;
  analyzing: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
  children?: ReactNode;
}

const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

export function Scanner({ photoUrl, busy, analyzing, onFile, onClear, children }: ScannerProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [touch] = useState(coarsePointer);
  const locked = busy || analyzing;

  // Paste a photo from the clipboard (desktop convenience).
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (locked) return;
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) onFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [locked, onFile]);

  const pick = (input: HTMLInputElement | null) => {
    if (!locked) input?.click();
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onFile(file);
  };

  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      if (!locked) setDragging(true);
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/') || !f.type);
      if (file && !locked) onFile(file);
    },
  };

  const state = analyzing ? 'analyzing' : photoUrl ? 'loaded' : 'empty';

  return (
    <div className={`scanner is-${state}${dragging ? ' is-dragging' : ''}`} {...dropHandlers}>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onInput} />
      <input ref={libraryInput} type="file" accept="image/*" hidden onChange={onInput} />

      <div className="scanner-frame">
        <span className="corner tl" aria-hidden="true" />
        <span className="corner tr" aria-hidden="true" />
        <span className="corner bl" aria-hidden="true" />
        <span className="corner br" aria-hidden="true" />

        {photoUrl ? (
          <figure className="scanner-photo">
            <img className="scanner-backdrop" src={photoUrl} alt="" aria-hidden="true" />
            <img className="scanner-image" src={photoUrl} alt="The piece you photographed" />
          </figure>
        ) : (
          <button
            type="button"
            className="scanner-empty"
            onClick={() => pick(touch ? cameraInput.current : libraryInput.current)}
            disabled={busy}
          >
            <svg className="scanner-garment" viewBox="0 0 200 220" aria-hidden="true">
              <path d="M70 20 Q100 38 130 20 L176 44 L196 112 L166 120 L156 86 L156 206 L44 206 L44 86 L34 120 L4 112 L24 44 Z" />
              <path d="M70 20 Q100 52 130 20" />
              <path d="M100 44 L100 206" />
            </svg>
            <span className="scanner-prompt">{busy ? 'Preparing photo' : touch ? 'Photograph the piece' : 'Drop a photo of the piece'}</span>
            <span className="scanner-hint">The whole garment, its label or its stitching. One clear photo is enough.</span>
          </button>
        )}

        <div className="scanner-sweep" aria-hidden="true" />
        {children}
      </div>

      {!analyzing && (
        <div className="scanner-actions">
          {photoUrl ? (
            <>
              <button type="button" className="text-button" onClick={() => pick(touch ? cameraInput.current : libraryInput.current)} disabled={locked}>
                Replace photo
              </button>
              <button type="button" className="text-button" onClick={onClear} disabled={locked}>
                Remove
              </button>
            </>
          ) : (
            <>
              {touch && (
                <button type="button" className="text-button" onClick={() => pick(cameraInput.current)} disabled={locked}>
                  Take photo
                </button>
              )}
              <button type="button" className="text-button" onClick={() => pick(libraryInput.current)} disabled={locked}>
                {touch ? 'Choose from library' : 'Choose photo'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
