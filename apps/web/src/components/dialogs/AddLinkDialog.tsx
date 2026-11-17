import { LinkBody } from '@app/domain';
import { Input } from '@app/ui';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';
import { FormField } from './FormField.tsx';

export function AddLinkDialog({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const { addLink } = useAlertMutations(alertId);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const parsed = LinkBody.safeParse({ title: title.trim(), url: url.trim() });
  const urlInvalid = url.trim() !== '' && !LinkBody.shape.url.safeParse(url.trim()).success;
  return (
    <ActionDialog
      title="Add link"
      submitLabel="Add link"
      canSubmit={parsed.success}
      onSubmit={() => addLink.mutateAsync({ title: title.trim(), url: url.trim() })}
      onClose={onClose}
    >
      <FormField label="Title">
        {(id) => (
          <Input
            id={id}
            aria-label="Title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
      </FormField>
      <FormField label="URL" error={urlInvalid ? 'Enter a valid http(s) URL' : undefined}>
        {(id) => (
          <Input
            id={id}
            aria-label="URL"
            aria-invalid={urlInvalid || undefined}
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
      </FormField>
    </ActionDialog>
  );
}
