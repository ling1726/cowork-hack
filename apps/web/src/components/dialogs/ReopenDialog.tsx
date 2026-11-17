import { Textarea } from '@app/ui';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';
import { FormField } from './FormField.tsx';

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
      <FormField label="Reason">
        {(id) => (
          <Textarea
            id={id}
            aria-label="Reason"
            value={reason}
            maxLength={2000}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </FormField>
    </ActionDialog>
  );
}
