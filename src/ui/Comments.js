import { Feather } from '@expo/vector-icons';
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

  const canSend = draft.trim().length > 0 && !post.isPending;

  return (
    <View style={styles.root}>
      <View style={styles.headRow}>
        <Feather name="message-circle" size={16} color={colors.textSoft} />
        <Text style={styles.heading}>
          {list.length ? `${list.length} ${list.length === 1 ? 'comment' : 'comments'}` : 'Comments'}
        </Text>
      </View>

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
          <Avatar url={comment.profiles?.avatar_url} name={comment.profiles?.full_name} size="sm" />
          {/* The bubble carries the name and the words together, so a thread reads
              as people talking rather than as a table of rows. */}
          <View style={styles.bubble}>
            <View style={styles.bubbleHead}>
              <Text style={styles.who} numberOfLines={1}>
                {comment.profiles?.full_name ?? 'Someone'}
              </Text>
              <Text style={styles.ago}>{when(comment.created_at)}</Text>
            </View>
            <Text style={styles.body}>{comment.body}</Text>
          </View>
        </Pressable>
      ))}

      {/* A thread that could not be fetched is not an empty thread. Saying "be
          the first" over other people's comments that simply did not arrive is
          the worst version of this mistake. */}
      {comments.isError ? (
        <Pressable style={styles.failed} onPress={() => comments.refetch()}>
          <Feather name="rotate-cw" size={13} color={colors.danger} />
          <Text style={styles.failedText}>
            {comments.isFetching ? 'Trying again…' : 'Could not load comments — tap to retry'}
          </Text>
        </Pressable>
      ) : list.length === 0 && !comments.isLoading ? (
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
          disabled={!canSend}
          hitSlop={8}
          style={[styles.send, !canSend && styles.sendOff]}
        >
          <Feather name="arrow-up" size={17} color={canSend ? '#fff' : colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { ...type.heading, color: colors.text },

  comment: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  bubble: {
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderTopLeftRadius: 4,
    backgroundColor: colors.surfaceAlt,
  },
  bubbleHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  who: { ...type.label, color: colors.text, flexShrink: 1 },
  ago: { ...type.tiny, color: colors.textMuted },
  body: { ...type.body, color: colors.textSoft },
  none: { ...type.caption, color: colors.textMuted },
  failed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  failedText: { ...type.caption, color: colors.danger, flex: 1 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  input: { ...type.body, flex: 1, color: colors.text, maxHeight: 110, paddingVertical: 8 },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { backgroundColor: colors.surfaceSunk },
});
