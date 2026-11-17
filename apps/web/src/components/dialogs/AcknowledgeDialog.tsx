import { Text } from '@fluentui/react-components';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';

export function AcknowledgeDialog({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const { acknowledge } = useAlertMutations(alertId);
  return (
    <ActionDialog
      title="Acknowledge alert"
      submitLabel="Acknowledge"
      canSubmit
      onSubmit={() => acknowledge.mutateAsync()}
      onClose={onClose}
    >
      <Text>Take ownership of this alert. It moves to In Progress.</Text>
    </ActionDialog>
  );
}
