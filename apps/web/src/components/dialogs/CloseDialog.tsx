import { RESOLUTION_OUTCOME_LABELS, ResolutionOutcome } from '@app/domain';
import { Dropdown, Field, Option, Textarea } from '@fluentui/react-components';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';

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
      <Field label="Outcome" required>
        <Dropdown
          aria-label="Outcome"
          placeholder="Choose an outcome"
          value={outcome ? RESOLUTION_OUTCOME_LABELS[outcome] : ''}
          selectedOptions={outcome ? [outcome] : []}
          onOptionSelect={(_e, d) => setOutcome(ResolutionOutcome.parse(d.optionValue))}
        >
          {ResolutionOutcome.options.map((o) => (
            <Option key={o} value={o}>
              {RESOLUTION_OUTCOME_LABELS[o]}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Note" required>
        <Textarea
          aria-label="Note"
          value={note}
          maxLength={2000}
          onChange={(_e, d) => setNote(d.value)}
        />
      </Field>
    </ActionDialog>
  );
}
