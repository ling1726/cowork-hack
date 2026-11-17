import { RESOLUTION_OUTCOME_LABELS, ResolutionOutcome } from '@app/domain';
import { Textarea } from '@app/ui';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';
import { FormField, SelectField } from './FormField.tsx';

export function CloseDialog({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const { close } = useAlertMutations(alertId);
  const [outcome, setOutcome] = useState<ResolutionOutcome>();
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  return (
    <ActionDialog
      title="Close alert"
      submitLabel="Close alert"
      canSubmit={Boolean(outcome && trimmed)}
      onSubmit={() => close.mutateAsync({ outcome: outcome as ResolutionOutcome, note: trimmed })}
      onClose={onClose}
    >
      <FormField label="Outcome">
        {(id) => (
          <SelectField
            id={id}
            label="Outcome"
            placeholder="Choose an outcome"
            value={outcome}
            options={ResolutionOutcome.options.map((o) => ({
              value: o,
              label: RESOLUTION_OUTCOME_LABELS[o],
            }))}
            onChange={(v) => setOutcome(ResolutionOutcome.parse(v))}
          />
        )}
      </FormField>
      <FormField label="Note">
        {(id) => (
          <Textarea
            id={id}
            aria-label="Note"
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </FormField>
    </ActionDialog>
  );
}
