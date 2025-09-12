#!/usr/bin/env node

// ユーザーのゴースト部屋を特定・削除するスクリプト
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

async function findUserGhostRooms(hostNameToFind) {
  try {
    console.log(`🔍 ホスト名 "${hostNameToFind}" の部屋を検索中...`);
    
    // 全ての進行中部屋を取得
    const roomsSnapshot = await db.collection('rooms')
      .where('status', 'in', ['clue', 'reveal', 'finished'])
      .get();
    
    console.log(`📋 進行中/完了部屋: ${roomsSnapshot.size} 件`);
    
    const ghostRooms = [];
    
    for (const doc of roomsSnapshot.docs) {
      const roomData = doc.data();
      const roomId = doc.id;
      
      // プレイヤー数とホスト名をチェック
      const playersSnapshot = await doc.ref.collection('players').get();
      const playerCount = playersSnapshot.size;
      
      // ホスト名が一致する部屋をチェック
      if (roomData.hostName && roomData.hostName.includes(hostNameToFind)) {
        console.log(`\n🏠 ホスト名一致: ${roomData.name || 'Unnamed'}`);
        console.log(`   ID: ${roomId}`);
        console.log(`   ホスト名: ${roomData.hostName}`);
        console.log(`   プレイヤー数: ${playerCount}人`);
        console.log(`   ステータス: ${roomData.status}`);
        console.log(`   最終アクティブ: ${roomData.lastActiveAt ? new Date(roomData.lastActiveAt.toMillis()).toLocaleString() : 'unknown'}`);
        
        // 実際のプレイヤーリストを確認
        if (playersSnapshot.size > 0) {
          console.log(`   プレイヤー一覧:`);
          playersSnapshot.docs.forEach(playerDoc => {
            const playerData = playerDoc.data();
            console.log(`     - ${playerData.name || playerDoc.id} (${playerData.connected ? 'オンライン' : 'オフライン'})`);
          });
        }
        
        // 0人または全員オフラインの場合はゴースト候補
        const allOffline = playersSnapshot.docs.every(pDoc => !pDoc.data().connected);
        if (playerCount === 0 || allOffline) {
          console.log(`   ⚠️  ゴースト部屋の可能性 - ${playerCount === 0 ? '0人' : '全員オフライン'}`);
          ghostRooms.push({
            id: roomId,
            name: roomData.name,
            hostName: roomData.hostName,
            status: roomData.status,
            playerCount,
            allOffline
          });
        }
      }
    }
    
    if (ghostRooms.length > 0) {
      console.log(`\n🗑️  削除候補のゴースト部屋: ${ghostRooms.length} 件`);
      return ghostRooms;
    } else {
      console.log(`\n✅ ホスト名 "${hostNameToFind}" のゴースト部屋は見つかりませんでした`);
      return [];
    }
    
  } catch (error) {
    console.error('❌ 検索中にエラー:', error);
    return [];
  }
}

async function deleteSpecificGhostRooms(ghostRooms) {
  console.log(`\n🗑️  ${ghostRooms.length} 件のゴースト部屋を削除中...`);
  
  for (const ghost of ghostRooms) {
    try {
      console.log(`削除中: ${ghost.name} (${ghost.id})`);
      
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
      console.log(`✅ 削除完了: ${ghost.name}`);
      
    } catch (error) {
      console.error(`❌ 削除失敗 ${ghost.name}:`, error);
    }
  }
}

// コマンドライン引数でホスト名を受け取る
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('使用方法: node find-user-ghost-rooms.js <ホスト名>');
  console.log('例: node find-user-ghost-rooms.js "あなたの名前"');
  process.exit(1);
}

const hostNameToFind = args[0];
const shouldDelete = args[1] === '--delete';

findUserGhostRooms(hostNameToFind).then(async (ghostRooms) => {
  if (ghostRooms.length > 0 && shouldDelete) {
    await deleteSpecificGhostRooms(ghostRooms);
    console.log('\n✅ ゴースト部屋の削除が完了しました');
  } else if (ghostRooms.length > 0) {
    console.log('\n⚠️  削除するには --delete フラグを追加してください');
    console.log(`node scripts/find-user-ghost-rooms.js "${hostNameToFind}" --delete`);
  }
  process.exit(0);
});