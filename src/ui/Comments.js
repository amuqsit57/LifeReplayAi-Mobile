import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { addComment, deleteComment, listComments } from '../lib/data';
import { colors, radius, spacing, type } from '../theme';
import { Avatar } from './social';

function when(iso) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

/**
 * The thread under a film.
 *
 * Only people in the event can read or write it — that is enforced by row level
 * security rather than here, so a comment cannot leak by way of a screen that
 * forgot to check.
 */
export default function Comments({ replayId, myId }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const comments = useQuery({
    queryKey: ['comments', replayId],
    queryFn: () => listComments(replayId),
    enabled: Boolean(replayId),
  });

  const post = useMutation({
    mutationFn: () => addComment(replayId, draft),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['comments', replayId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => Alert.alert('Could not post', error.message),
  });

  const remove = useMutation({
    mutationFn: (commentId) => deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', replayId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const list = comments.data ?? [];

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>
        {list.length ? `${list.length} ${list.length === 1 ? 'comment' : 'comments'}` : 'Comments'}
      </Text>

      {list.map((comment) => (
        <Pressable
          key={comment.id}
          onLongPress={() => {
            if (comment.user_id !== myId) return;
            Alert.alert('Delete your comment?', '', [
              { text: 'Keep', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(comment.id) },
            ]);
          }}
          style={styles.comment}
        >
          <Avatar
            url={comment.profiles?.avatar_url}
            name={comment.profiles?.full_name}
            size="sm"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.who}>
              {comment.profiles?.full_name ?? 'Someone'}{' '}
              <Text style={styles.ago}>{when(comment.created_at)}</Text>
            </Text>
            <Text style={styles.body}>{comment.body}</Text>
          </View>
        </Pressable>
      ))}

      {list.length === 0 && !comments.isLoading ? (
        <Text style={styles.none}>Be the first to say something.</Text>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={() => post.mutate()}
          disabled={!draft.trim() || post.isPending}
          hitSlop={8}
          style={styles.send}
        >
          <Text style={[styles.sendText, (!draft.trim() || post.isPending) && styles.sendOff]}>
            {post.isPending ? '…' : 'Post'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  heading: { ...type.heading, color: colors.text },
  comment: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  who: { ...type.label, color: colors.text },
  ago: { ...type.caption, color: colors.textMuted },
  body: { ...type.body, color: colors.textSoft },
  none: { ...type.caption, color: colors.textMuted },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  input: { ...type.body, flex: 1, color: colors.text, maxHeight: 110, paddingVertical: 4 },
  send: { paddingHorizontal: spacing.sm, paddingVertical: 6 },
  sendText: { ...type.label, color: colors.primary },
  sendOff: { color: colors.textMuted },
});
