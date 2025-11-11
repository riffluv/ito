/**
 * Vercel環境でのPresence問題対策: Heartbeat API
 * 定期的にユーザーのlastSeenを更新
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

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
    // Firebase Admin SDKでFirestoreのプレイヤードキュメントのlastSeenを更新
    const db = getAdminDb();
    const playerRef = db.collection('rooms').doc(roomId as string).collection('players').doc(uid);
    await playerRef.update({
      lastSeen: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Heartbeat update failed:', error);
    return res.status(500).json({ error: 'Failed to update heartbeat' });
  }
}
