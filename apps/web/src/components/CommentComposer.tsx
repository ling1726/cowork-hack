import { unwrap } from '@app/api-client';
import { Button, Textarea } from '@app/ui';
import { CircleAlert } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api.ts';

export function CommentComposer({ alertId }: { alertId: string }) {
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
      className="flex flex-col items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (body) post.mutate(body);
      }}
    >
      {post.isError && (
        <p role="alert" className="flex w-full items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4" />
          {post.error.message}
        </p>
      )}
      <Textarea
        aria-label="Add a comment"
        placeholder="Add a comment…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-20 w-full"
      />
      <Button type="submit" disabled={!body || post.isPending}>
        Post comment
      </Button>
    </form>
  );
}
