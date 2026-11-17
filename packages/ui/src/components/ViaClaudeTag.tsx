import { Badge } from '@fluentui/react-components';

/** Marks an entry that Claude produced. `approvedByName` is shown once a human approved it. */
export function ViaClaudeTag({ approvedByName }: { approvedByName?: string }) {
  return (
    <Badge data-testid="via-claude" appearance="outline" color="brand">
      {approvedByName ? `via Claude · approved by ${approvedByName}` : 'via Claude'}
    </Badge>
  );
}
