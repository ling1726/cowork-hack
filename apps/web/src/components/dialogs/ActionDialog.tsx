import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@app/ui';
import { CircleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* No corner X: "Close" must stay unique to the Close-alert action on the page. */}
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !pending) void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex flex-col gap-4">{children}</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
