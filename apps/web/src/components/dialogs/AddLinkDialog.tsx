import { LinkBody } from '@app/domain';
import { Field, Input } from '@fluentui/react-components';
import { useState } from 'react';
import { useAlertMutations } from '../../hooks/useAlertMutations.ts';
import { ActionDialog } from './ActionDialog.tsx';

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
      <Field label="Title" required>
        <Input
          aria-label="Title"
          value={title}
          maxLength={200}
          onChange={(_e, d) => setTitle(d.value)}
        />
      </Field>
      <Field
        label="URL"
        required
        validationState={urlInvalid ? 'error' : 'none'}
        validationMessage={urlInvalid ? 'Enter a valid http(s) URL' : undefined}
      >
        <Input aria-label="URL" value={url} onChange={(_e, d) => setUrl(d.value)} />
      </Field>
    </ActionDialog>
  );
}
