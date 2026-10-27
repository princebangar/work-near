import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, onSocket } from '@/lib/socket';
import { useAuth } from '@/store';
import { bumpConversation, lastMessagePatch, qk, upsertConversation, upsertMessage } from '@/api';

/**
 * App-wide realtime cache updates for the signed-in user (mounted once in the signed-in layout) — port of the web hook.
 * Socket events are written straight into the React Query cache — the chat list / thread never refetch per message.
 */
export function useRealtime() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) return;
    // Skip the very first `connect` (initial load already fetched). Any later one is a reconnect → catch up once.
    let skipConnect = !getSocket()?.connected;
    const offs = [
      onSocket('connect', () => {
        if (skipConnect) return void (skipConnect = false);
        qc.invalidateQueries({ queryKey: qk.conversations });
        qc.invalidateQueries({ queryKey: qk.notifications });
      }),

      onSocket('message:new', ({ message, conversation }) => {
        upsertMessage(qc, message);
        if (conversation) {
          const known = qc.getQueryData(qk.conversations);
          if (known) upsertConversation(qc, conversation);
        } else {
          bumpConversation(qc, message.conversationId, lastMessagePatch(message));
        }
      }),

      onSocket('conversation:read', ({ conversationId }) => {
        const me = useAuth.getState().user?.id;
        qc.setQueryData(qk.messages(conversationId), (t) => t && { ...t, items: t.items.map((m) => (m.senderId === me && m.status === 'sent' ? { ...m, status: 'read' } : m)) });
      }),

      // Notifications that mean server-side state changed for this user → refresh just that slice.
      onSocket('notification:new', (n) => {
        if (n.type === 'verification') {
          qc.invalidateQueries({ queryKey: qk.workerDash });
          qc.invalidateQueries({ queryKey: qk.myWorker });
          qc.invalidateQueries({ queryKey: qk.myVerification });
          qc.invalidateQueries({ queryKey: qk.me });
        } else if (n.type === 'subscription') {
          qc.invalidateQueries({ queryKey: ['subscription'] });
        } else if (n.type === 'complaint') {
          qc.invalidateQueries({ queryKey: qk.complaints });
        } else if (n.link === '/my-profile') {
          qc.invalidateQueries({ queryKey: qk.myWorker });
          qc.invalidateQueries({ queryKey: qk.workerDash });
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [token, qc]);
}
