import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  children: ReactNode;
  onClose: () => void;
  ariaLabelledBy: string;
  ariaDescribedBy?: string;
  className?: string;
  scrimClassName?: string;
  role?: 'dialog' | 'alertdialog';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const focusableSelector = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function Dialog({
  children,
  onClose,
  ariaLabelledBy,
  ariaDescribedBy,
  className = '',
  scrimClassName = '',
  role = 'dialog',
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
}: DialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef(document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null);
  const scrollPosition = useRef({ x: window.scrollX, y: window.scrollY });

  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const target = initialFocusRef?.current
      ?? dialogRef.current?.querySelector<HTMLElement>(focusableSelector)
      ?? dialogRef.current;
    target?.focus({ preventScroll: true });

    return () => {
      root.style.overflow = previousOverflow;
      const { x, y } = scrollPosition.current;
      window.requestAnimationFrame(() => {
        if (x !== 0 || y !== 0) window.scrollTo(x, y);
        if (previousFocus.current?.isConnected) {
          previousFocus.current.focus({ preventScroll: true });
        }
      });
    };
  }, [initialFocusRef]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={`dialog-scrim${scrimClassName ? ` ${scrimClassName}` : ''}`}
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`picker-dialog${className ? ` ${className}` : ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
