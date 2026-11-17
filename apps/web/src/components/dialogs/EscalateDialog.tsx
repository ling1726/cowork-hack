import type { Alert, User } from '@app/domain';
import { Textarea } from '@app/ui';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';
import { FormField, SelectField } from './FormField.tsx';

export interface EscalateDialogProps {
  alert: Alert;
  users: User[];
  onClose: () => void;
}

export function EscalateDialog({ alert, users, onClose }: EscalateDialogProps) {
  const { escalate } = useAlertMutations(alert.id);
  const [toUserId, setToUserId] = useState<string>();
  const [reason, setReason] = useState('');
  const already = new Set(alert.assignees.escalatedTo.map((e) => e.userId));
  const candidates = users.filter((u) => !already.has(u.id));
  const trimmed = reason.trim();
  return (
    <ActionDialog
      title="Escalate alert"
      submitLabel="Escalate"
      canSubmit={Boolean(toUserId && trimmed)}
      onSubmit={() => escalate.mutateAsync({ toUserId: toUserId as string, reason: trimmed })}
      onClose={onClose}
    >
      <FormField label="Escalate to">
        {(id) => (
          <SelectField
            id={id}
            label="Escalate to"
            placeholder="Choose a person"
            value={toUserId}
            options={candidates.map((u) => ({ value: u.id, label: u.name }))}
            onChange={setToUserId}
          />
        )}
      </FormField>
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
