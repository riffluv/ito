#!/usr/bin/env node

// 全てのオフライン部屋を一括削除するスクリプト
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

async function cleanupAllOfflineRooms() {
  try {
    console.log('🔍 全ての進行中/完了部屋から全員オフラインの部屋を検索中...');
    
    // 進行中・完了状態の全部屋を取得
    const roomsSnapshot = await db.collection('rooms')
      .where('status', 'in', ['clue', 'reveal', 'finished'])
      .get();
    
    console.log(`📋 対象部屋: ${roomsSnapshot.size} 件`);
    
    const ghostRooms = [];
    
    for (const doc of roomsSnapshot.docs) {
      const roomData = doc.data();
      const roomId = doc.id;
      
      // プレイヤー数とオンライン状況をチェック
      const playersSnapshot = await doc.ref.collection('players').get();
      const playerCount = playersSnapshot.size;
      
      // 全員オフラインまたは0人かをチェック
      const allOffline = playerCount === 0 || playersSnapshot.docs.every(pDoc => !pDoc.data().connected);
      
      if (allOffline) {
        console.log(`\n🗑️  ゴースト部屋: ${roomData.name || 'Unnamed'}`);
        console.log(`   ID: ${roomId}`);
        console.log(`   ホスト: ${roomData.hostName || 'unknown'}`);
        console.log(`   プレイヤー数: ${playerCount}人`);
        console.log(`   ステータス: ${roomData.status}`);
        
        ghostRooms.push({
          id: roomId,
          name: roomData.name,
          hostName: roomData.hostName,
          status: roomData.status,
          playerCount
        });
      }
    }
    
    if (ghostRooms.length === 0) {
      console.log('\n✅ 削除対象のゴースト部屋は見つかりませんでした');
      return;
    }
    
    console.log(`\n🗑️  削除対象: ${ghostRooms.length} 件のゴースト部屋`);
    
    // 削除実行
    let deletedCount = 0;
    for (const ghost of ghostRooms) {
      try {
        console.log(`削除中: ${ghost.name} (ホスト: ${ghost.hostName})`);
        
        const roomRef = db.collection('rooms').doc(ghost.id);
        
        // サブコレクション削除
        const playersSnapshot = await roomRef.collection('players').get();
        for (const playerDoc of playersSnapshot.docs) {
          await playerDoc.ref.delete();
        }
        
        const chatSnapshot = await roomRef.collection('chat').get();
        for (const chatDoc of chatSnapshot.docs) {
          await chatDoc.ref.delete();
        }
        
        // ルームドキュメント削除
        await roomRef.delete();
        deletedCount++;
        console.log(`✅ 削除完了: ${ghost.name}`);
        
      } catch (error) {
        console.error(`❌ 削除失敗 ${ghost.name}:`, error);
      }
    }
    
    console.log(`\n✅ ${deletedCount} 件のゴースト部屋を削除しました`);
    
  } catch (error) {
    console.error('❌ 削除中にエラー:', error);
  }
}

cleanupAllOfflineRooms().then(() => process.exit(0));