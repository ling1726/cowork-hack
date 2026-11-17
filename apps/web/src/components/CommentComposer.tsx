import { unwrap } from '@app/api-client';
import {
  Button,
  MessageBar,
  MessageBarBody,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api.ts';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    alignItems: 'flex-start',
  },
});

export function CommentComposer({ alertId }: { alertId: string }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const post = useMutation({
    mutationFn: async (body: string) =>
      unwrap(
        await api.POST('/api/alerts/{id}/comments', {
          params: { path: { id: alertId } },
          body: { body },
        }),
      ),
    onSuccess: async () => {
      setText('');
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const body = text.trim();
  return (
    <form
      className={styles.root}
      onSubmit={(e) => {
        e.preventDefault();
        if (body) post.mutate(body);
      }}
    >
      {post.isError && (
        <MessageBar intent="error">
          <MessageBarBody>{post.error.message}</MessageBarBody>
        </MessageBar>
      )}
      <Textarea
        aria-label="Add a comment"
        placeholder="Add a comment"
        value={text}
        onChange={(_e, d) => setText(d.value)}
        resize="vertical"
        style={{ width: '100%' }}
      />
      <Button type="submit" appearance="primary" disabled={!body || post.isPending}>
        Post comment
      </Button>
    </form>
  );
}
