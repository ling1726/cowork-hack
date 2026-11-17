import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Switch,
  Text,
} from '@fluentui/react-components';
import { useApprovalSetting } from '../hooks/useActionRequests.ts';
import { useUiStore } from '../store/ui-store.ts';

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const userId = useUiStore((s) => s.currentUserId);
  const { query, update } = useApprovalSetting(userId);
  return (
    <Dialog open onOpenChange={(_e, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Settings</DialogTitle>
          <DialogContent>
            <Switch
              label="Require approval for Claude's actions"
              checked={query.data?.requireApprovalForAgentActions ?? true}
              disabled={query.isPending || update.isPending}
              onChange={(_e, d) => update.mutate(d.checked)}
            />
            <Text block size={200}>
              When on, anything Claude wants to change waits in your queue until you approve it.
            </Text>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={onClose}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
