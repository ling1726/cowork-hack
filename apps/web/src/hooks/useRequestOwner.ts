import { useUsers } from '../hooks.ts';
import { useUiStore } from '../store/ui-store.ts';

/** Only the user Claude acted for may approve or reject; others see the request read-only. */
export function useActionRequestOwner(onBehalfOf: string) {
  const currentUserId = useUiStore((s) => s.currentUserId);
  const { data: users = [] } = useUsers();
  return {
    canDecide: currentUserId === onBehalfOf,
    ownerName: users.find((u) => u.id === onBehalfOf)?.name ?? onBehalfOf,
  };
}
