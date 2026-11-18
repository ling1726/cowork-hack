import { COWORK_CASE_LABELS, coworkLink, coworkPrompt, type CoworkCase } from '@app/domain';
import {
  Button,
  buttonVariants,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@app/ui';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

const HINT = 'Claude will fetch the alert itself. Nothing is sent until you press Send in Cowork.';
const AFTER_OPEN = "If Cowork didn't open, copy the prompt and paste it into a new Cowork session.";

export interface OpenInCoworkDialogProps {
  coworkCase: CoworkCase;
  onClose: () => void;
}

/**
 * Lets the analyst review and edit the prompt, then open it in a new Cowork session or copy it.
 * Mount it only while it is open: unmounting resets the prompt to the case's text.
 */
export function OpenInCoworkDialog({ coworkCase, onClose }: OpenInCoworkDialogProps) {
  const [text, setText] = useState(() => coworkPrompt(coworkCase));
  const [status, setStatus] = useState('');
  const href = coworkLink(text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied.');
    } catch (e) {
      setStatus(`Copy failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* No corner X: "Close" must stay unique to the Close-alert action on the page. */}
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{COWORK_CASE_LABELS[coworkCase.kind]}</DialogTitle>
        </DialogHeader>
        <Textarea
          aria-label="Prompt"
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setStatus('');
          }}
        />
        <p className="text-sm text-muted-foreground">{HINT}</p>
        <p role="status" className="min-h-5 text-sm">
          {status}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => void copy()}>
            Copy prompt
          </Button>
          <a
            data-testid="open-in-cowork"
            className={buttonVariants()}
            {...(href
              ? { href, onClick: () => setStatus(AFTER_OPEN) }
              : { 'aria-disabled': true, role: 'link' })}
          >
            <Sparkles />
            Open in Cowork
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface OpenInCoworkButtonProps {
  coworkCase: CoworkCase;
  label?: string;
  variant?: 'outline' | 'ghost';
  size?: 'sm' | 'default';
}

/** A button that opens the Cowork dialog for one case. It never leaves the app by itself. */
export function OpenInCoworkButton({
  coworkCase,
  label = COWORK_CASE_LABELS[coworkCase.kind],
  variant = 'outline',
  size = 'sm',
}: OpenInCoworkButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        data-testid={`cowork-${coworkCase.kind}`}
        onClick={() => setOpen(true)}
      >
        <Sparkles />
        {label}
      </Button>
      {open && <OpenInCoworkDialog coworkCase={coworkCase} onClose={() => setOpen(false)} />}
    </>
  );
}
