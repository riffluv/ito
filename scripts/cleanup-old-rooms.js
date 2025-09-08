#!/usr/bin/env node

// 古い部屋を削除するクリーンアップスクリプト
// 使用方法: node scripts/cleanup-old-rooms.js

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const path = require('path');

// Firebase Admin初期化
const serviceAccountPath = path.join(__dirname, '../service-account-key.json');

let app;
try {
  const serviceAccount = require(serviceAccountPath);
  app = initializeApp({
    credential: cert(serviceAccount)
  });
} catch (error) {
  console.error('❌ service-account-key.json が見つかりません');
  console.log('Firebase Admin SDK の認証情報が必要です');
  console.log('1. Firebase Console → プロジェクト設定 → サービスアカウント');
  console.log('2. 新しい秘密鍵を生成');
  console.log('3. ダウンロードしたJSONファイルを service-account-key.json として保存');
  process.exit(1);
}

const db = getFirestore(app);

async function cleanupOldRooms() {
  try {
    console.log('🧹 古い部屋の削除を開始...');
    
    // 7日前よりも古い部屋を削除対象とする
    const weekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    
    const roomsSnapshot = await db.collection('rooms')
      .where('createdAt', '<', weekAgo)
      .get();
    
    if (roomsSnapshot.empty) {
      console.log('✅ 削除対象の古い部屋はありません');
      return;
    }
    
    console.log(`📋 ${roomsSnapshot.size} 件の古い部屋が見つかりました`);
    
    let deletedCount = 0;
    for (const doc of roomsSnapshot.docs) {
      const roomData = doc.data();
      console.log(`🗑️  削除中: ${roomData.name || 'Unnamed'} (ID: ${doc.id})`);
      
      // サブコレクション（players, chat）も削除
      const playersSnapshot = await doc.ref.collection('players').get();
      for (const playerDoc of playersSnapshot.docs) {
        await playerDoc.ref.delete();
      }
      
      const chatSnapshot = await doc.ref.collection('chat').get();
      for (const chatDoc of chatSnapshot.docs) {
        await chatDoc.ref.delete();
      }
      
      // ルームドキュメント本体を削除
      await doc.ref.delete();
      deletedCount++;
    }
    
    console.log(`✅ ${deletedCount} 件の古い部屋を削除しました`);
    
  } catch (error) {
    console.error('❌ 削除中にエラーが発生:', error);
  }
}

// 手動削除モード: 特定の部屋IDを指定して削除
async function deleteSpecificRoom(roomId) {
  try {
    console.log(`🗑️  部屋 ${roomId} を削除中...`);
    
    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();
    
    if (!roomDoc.exists) {
      console.log('❌ 指定された部屋が見つかりません');
      return;
    }
    
    // サブコレクションを削除
    const playersSnapshot = await roomRef.collection('players').get();
    for (const playerDoc of playersSnapshot.docs) {
      await playerDoc.ref.delete();
    }
    
    const chatSnapshot = await roomRef.collection('chat').get();
    for (const chatDoc of chatSnapshot.docs) {
      await chatDoc.ref.delete();
    }
    
    // ルームドキュメントを削除
    await roomRef.delete();
    
    console.log(`✅ 部屋 ${roomId} を削除しました`);
    
  } catch (error) {
    console.error('❌ 削除中にエラー:', error);
  }
}

// コマンドライン引数をチェック
const args = process.argv.slice(2);

if (args.length > 0) {
  // 特定の部屋IDが指定された場合
  deleteSpecificRoom(args[0]).then(() => process.exit(0));
} else {
  // 古い部屋の一括削除
  cleanupOldRooms().then(() => process.exit(0));
}