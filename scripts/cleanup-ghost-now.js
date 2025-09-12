#!/usr/bin/env node

// 現在の0人ゴースト部屋を即座に削除するスクリプト
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../service-account-key.json');

let app;
try {
  const serviceAccount = require(serviceAccountPath);
  app = initializeApp({
    credential: cert(serviceAccount)
  });
} catch (error) {
  console.error('❌ service-account-key.json が見つかりません');
  process.exit(1);
}

const db = getFirestore(app);

async function cleanupGhostRooms() {
  try {
    console.log('🔍 0人のゴースト部屋を検索中...');
    
    // 全ての部屋を取得
    const roomsSnapshot = await db.collection('rooms').get();
    
    if (roomsSnapshot.empty) {
      console.log('✅ 部屋が見つかりません');
      return;
    }
    
    console.log(`📋 ${roomsSnapshot.size} 件の部屋を確認中...`);
    
    let deletedCount = 0;
    for (const doc of roomsSnapshot.docs) {
      const roomData = doc.data();
      const roomId = doc.id;
      
      // プレイヤー数をチェック
      const playersSnapshot = await doc.ref.collection('players').get();
      const playerCount = playersSnapshot.size;
      
      // 0人でゲーム中(waiting以外)の部屋を削除対象に
      const isGhost = playerCount === 0 && roomData.status && roomData.status !== 'waiting';
      
      if (isGhost) {
        console.log(`🗑️  ゴースト部屋削除: ${roomData.name || 'Unnamed'} (ID: ${roomId}, Status: ${roomData.status}, Players: ${playerCount})`);
        
        // サブコレクション削除
        for (const playerDoc of playersSnapshot.docs) {
          await playerDoc.ref.delete();
        }
        
        const chatSnapshot = await doc.ref.collection('chat').get();
        for (const chatDoc of chatSnapshot.docs) {
          await chatDoc.ref.delete();
        }
        
        // ルームドキュメント削除
        await doc.ref.delete();
        deletedCount++;
      } else {
        console.log(`✅ 正常な部屋: ${roomData.name || 'Unnamed'} (Players: ${playerCount}, Status: ${roomData.status})`);
      }
    }
    
    console.log(`✅ ${deletedCount} 件のゴースト部屋を削除しました`);
    
  } catch (error) {
    console.error('❌ 削除中にエラーが発生:', error);
  }
}

cleanupGhostRooms().then(() => process.exit(0));