import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Dialog } from '../components/Dialog';

export type ConfirmDialogTone = 'primary' | 'danger';

export interface ConfirmDialogOptions {
  title: string;
  message: ReactNode;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
}

type ConfirmDialogRequest = {
  options: ConfirmDialogOptions;
  resolve: (accepted: boolean) => void;
};

type ConfirmDialogFunction = (options: ConfirmDialogOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmDialogFunction | undefined>(undefined);

export function useConfirmDialog(): ConfirmDialogFunction {
  const confirm = useContext(ConfirmDialogContext);
  if (!confirm) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider.');
  return confirm;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmDialogRequest>();
  const requestRef = useRef<ConfirmDialogRequest | undefined>(undefined);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const finish = useCallback((accepted: boolean) => {
    const current = requestRef.current;
    if (!current) return;
    requestRef.current = undefined;
    setRequest(undefined);
    current.resolve(accepted);
  }, []);

  const confirm = useCallback<ConfirmDialogFunction>((options) => new Promise((resolve) => {
    requestRef.current?.resolve(false);
    const next = { options, resolve };
    requestRef.current = next;
    setRequest(next);
  }), []);

  useEffect(() => () => {
    requestRef.current?.resolve(false);
    requestRef.current = undefined;
  }, []);

  const options = request?.options;

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {options && (
        <Dialog
          className={`confirm-dialog confirm-dialog--${options.tone ?? 'primary'}`}
          scrimClassName="confirm-dialog-scrim"
          role="alertdialog"
          ariaLabelledBy={titleId}
          ariaDescribedBy={descriptionId}
          initialFocusRef={cancelButtonRef}
          onClose={() => finish(false)}
        >
          <header className="confirm-dialog__header">
            <div>
              <span className="eyebrow">{options.eyebrow ?? 'Confirm action'}</span>
              <h2 id={titleId}>{options.title}</h2>
            </div>
            <span className="confirm-dialog__index" aria-hidden="true">?</span>
          </header>
          <div className="confirm-dialog__body">
            <span className="confirm-dialog__mark" aria-hidden="true">!</span>
            <p id={descriptionId}>{options.message}</p>
          </div>
          <footer className="confirm-dialog__actions">
            <button ref={cancelButtonRef} className="secondary-button" type="button" onClick={() => finish(false)}>
              {options.cancelLabel ?? '取消'}
            </button>
            <button
              className={options.tone === 'danger' ? 'danger-button confirm-dialog__danger' : 'primary-button'}
              type="button"
              onClick={() => finish(true)}
            >
              {options.confirmLabel ?? '确认'}
            </button>
          </footer>
        </Dialog>
      )}
    </ConfirmDialogContext.Provider>
  );
}
