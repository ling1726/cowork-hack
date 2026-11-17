import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useState, type ReactNode } from 'react';

const useStyles = makeStyles({
  fields: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
});

export interface ActionDialogProps {
  title: string;
  submitLabel: string;
  canSubmit: boolean;
  /** Resolves when the action succeeded. A rejection is shown in the dialog, which stays open. */
  onSubmit: () => Promise<unknown>;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Shared shell for every action dialog. Mount it only while it is needed: unmounting on close
 * is what resets each dialog's form state and any previous error.
 */
export function ActionDialog({
  title,
  submitLabel,
  canSubmit,
  onSubmit,
  onClose,
  children,
}: ActionDialogProps) {
  const styles = useStyles();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    setError(undefined);
    try {
      await onSubmit();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_e, d) => !d.open && onClose()} modalType="modal">
      <DialogSurface>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !pending) void submit();
          }}
        >
          <DialogBody>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent className={styles.fields}>
              {error && (
                <MessageBar intent="error">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
              {children}
            </DialogContent>
            <DialogActions>
              <Button type="button" appearance="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" appearance="primary" disabled={!canSubmit || pending}>
                {submitLabel}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
