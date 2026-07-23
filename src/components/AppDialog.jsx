import { useEffect, useId, useRef } from 'react';

export default function AppDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const primaryButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    if (destructive && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    } else {
      primaryButtonRef.current?.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onCancel) onCancel();
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [destructive, onCancel, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && onCancel) onCancel();
    }}>
      <section
        ref={dialogRef}
        className="app-dialog glass-panel"
        role={destructive ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{title}</h2>
        <div id={descriptionId} className="dialog-message">{message}</div>
        <div className="dialog-actions">
          {cancelLabel && (
            <button ref={cancelButtonRef} type="button" className="btn btn-secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            ref={primaryButtonRef}
            type="button"
            className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
