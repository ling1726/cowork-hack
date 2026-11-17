import type { Alert, User } from '@app/domain';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';
import { FormField, SelectField } from './FormField.tsx';

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
  const options = users.map((u) => ({ value: u.id, label: u.name }));
  return (
    <ActionDialog
      title="Edit assignees"
      submitLabel="Save"
      canSubmit={!same}
      onSubmit={() => setAssignees.mutateAsync({ primaryId, backupId })}
      onClose={onClose}
    >
      <FormField label="Primary">
        {(id) => (
          <SelectField
            id={id}
            label="Primary"
            placeholder="Choose a person"
            value={primaryId}
            options={options}
            onChange={setPrimaryId}
          />
        )}
      </FormField>
      <FormField label="Backup">
        {(id) => (
          <SelectField
            id={id}
            label="Backup"
            placeholder="Choose a person"
            value={backupId}
            options={options}
            onChange={setBackupId}
          />
        )}
      </FormField>
      {same && (
        <p role="alert" className="text-sm text-destructive">
          Primary and backup must be different people.
        </p>
      )}
    </ActionDialog>
  );
}
