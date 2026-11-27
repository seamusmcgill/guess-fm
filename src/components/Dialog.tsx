import { Children, useEffect, useRef, type ReactNode } from 'react';
import Icon from './Icon';

interface Props {
  open: boolean;
  title: string;
  // Dialogs that drive the game (welcome, round start, game over) can't be dismissed; info ones can.
  onClose?: () => void;
  width?: 'xs' | 'sm' | 'md';
  slide?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}

export default function Dialog({ open, title, onClose, width = 'sm', slide, children, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current!;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog ${width}${slide ? ' slide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {onClose && (
        <button className="dialog-close" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      )}
      <h2 className="glow">{title}</h2>
      {/* No body at all when there's nothing in it, so a title-and-button dialog has no hole. */}
      {Children.toArray(children).length > 0 && <div className="dialog-content">{children}</div>}
      {actions && <div className="dialog-actions">{actions}</div>}
    </dialog>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" role="progressbar" aria-label="Loading" />;
}
