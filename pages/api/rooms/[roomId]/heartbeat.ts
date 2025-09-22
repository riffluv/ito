/**
 * Vercel環境でのPresence問題対策: Heartbeat API
 * 定期的にユーザーのlastSeenを更新
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/server';

export default async function heartbeatHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { roomId } = req.query;
  const { uid } = req.body;

  if (!roomId || !uid) {
    return res.status(400).json({ error: 'Missing roomId or uid' });
  }

  try {
    // FirestoreのプレイヤードキュメントのlastSeenを更新
    const playerRef = doc(db, 'rooms', roomId as string, 'players', uid);
    await updateDoc(playerRef, {
      lastSeen: serverTimestamp(),
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Heartbeat update failed:', error);
    res.status(500).json({ error: 'Failed to update heartbeat' });
  }
}