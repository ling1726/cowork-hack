import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Switch,
} from '@app/ui';
import { useId } from 'react';
import { useApprovalSetting } from '../hooks/useActionRequests.ts';
import { useUiStore } from '../store/ui-store.ts';

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const userId = useUiStore((s) => s.currentUserId);
  const { query, update } = useApprovalSetting(userId);
  const switchId = useId();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={switchId}>Require approval for Claude's actions</Label>
            <DialogDescription>
              When on, anything Claude wants to change waits in your queue until you approve it.
            </DialogDescription>
          </div>
          <Switch
            id={switchId}
            aria-label="Require approval for Claude's actions"
            checked={query.data?.requireApprovalForAgentActions ?? true}
            disabled={query.isPending || update.isPending}
            onCheckedChange={(checked) => update.mutate(checked)}
          />
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
