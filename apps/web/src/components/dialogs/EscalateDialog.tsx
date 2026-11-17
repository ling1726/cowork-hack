import type { Alert, User } from '@app/domain';
import { Dropdown, Field, Option, Textarea } from '@fluentui/react-components';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';

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
      <Field label="Escalate to" required>
        <Dropdown
          aria-label="Escalate to"
          placeholder="Choose a person"
          value={users.find((u) => u.id === toUserId)?.name ?? ''}
          selectedOptions={toUserId ? [toUserId] : []}
          onOptionSelect={(_e, d) => setToUserId(d.optionValue)}
        >
          {candidates.map((u) => (
            <Option key={u.id} value={u.id} text={u.name}>
              {u.name}
            </Option>
          ))}
        </Dropdown>
      </Field>
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
