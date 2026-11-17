import { Field, Textarea } from '@fluentui/react-components';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';

export function ReopenDialog({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const { reopen } = useAlertMutations(alertId);
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  return (
    <ActionDialog
      title="Reopen alert"
      submitLabel="Reopen alert"
      canSubmit={Boolean(trimmed)}
      onSubmit={() => reopen.mutateAsync(trimmed)}
      onClose={onClose}
    >
      <Field label="Reason" required>
        <Textarea
          aria-label="Reason"
          value={reason}
          maxLength={2000}
          onChange={(_e, d) => setReason(d.value)}
        />
      </Field>
    </ActionDialog>
  );
}
