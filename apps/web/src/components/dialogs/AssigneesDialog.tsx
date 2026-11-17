import type { Alert, User } from '@app/domain';
import { Dropdown, Field, Option } from '@fluentui/react-components';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';

function UserPicker({
  label,
  users,
  value,
  onChange,
}: {
  label: string;
  users: User[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Field label={label} required>
      <Dropdown
        aria-label={label}
        value={users.find((u) => u.id === value)?.name ?? value}
        selectedOptions={[value]}
        onOptionSelect={(_e, d) => d.optionValue && onChange(d.optionValue)}
      >
        {users.map((u) => (
          <Option key={u.id} value={u.id} text={u.name}>
            {u.name}
          </Option>
        ))}
      </Dropdown>
    </Field>
  );
}

export function AssigneesDialog({
  alert,
  users,
  onClose,
}: {
  alert: Alert;
  users: User[];
  onClose: () => void;
}) {
  const { setAssignees } = useAlertMutations(alert.id);
  const [primaryId, setPrimaryId] = useState(alert.assignees.primaryId);
  const [backupId, setBackupId] = useState(alert.assignees.backupId);
  const same = primaryId === backupId;
  return (
    <ActionDialog
      title="Edit assignees"
      submitLabel="Save"
      canSubmit={!same}
      onSubmit={() => setAssignees.mutateAsync({ primaryId, backupId })}
      onClose={onClose}
    >
      <UserPicker label="Primary" users={users} value={primaryId} onChange={setPrimaryId} />
      <UserPicker label="Backup" users={users} value={backupId} onChange={setBackupId} />
      {same && <p role="alert">Primary and backup must be different people.</p>}
    </ActionDialog>
  );
}
