#!/usr/bin/env node

// ロビー表示の正確なロジックに合わせた部屋取得スクリプト
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

async function getExactLobbyRooms() {
  try {
    console.log('🔍 ロビー表示と完全に同じロジックで部屋を取得...');
    
    // useOptimizedRoomsと同じロジック
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000);
    
    // 1. 直近の部屋
    const qRecent = db.collection('rooms')
      .where('lastActiveAt', '>=', Timestamp.fromDate(threeMinAgo))
      .orderBy('lastActiveAt', 'desc')
      .limit(5);
    
    // 2. 進行中の部屋
    const qInprog = db.collection('rooms')
      .where('status', 'in', ['clue', 'reveal'])
      .limit(3);
    
    const [snapRecent, snapInprog] = await Promise.all([
      qRecent.get(),
      qInprog.get()
    ]);
    
    console.log(`📋 直近3分: ${snapRecent.size} 件`);
    console.log(`📋 進行中: ${snapInprog.size} 件`);
    
    // 期限切れチェック
    const now = Date.now();
    const filterValid = (roomData) => {
      const exp = roomData.expiresAt;
      const expMs = typeof exp?.toMillis === 'function' ? exp.toMillis() : 0;
      if (expMs && expMs <= now) return false;
      return true;
    };
    
    const recentRooms = [];
    const inprogRooms = [];
    
    // 直近の部屋を処理
    for (const doc of snapRecent.docs) {
      const roomData = doc.data();
      if (filterValid(roomData)) {
        const playersSnapshot = await doc.ref.collection('players').get();
        const playerCount = playersSnapshot.size;
        
        console.log(`\n🕐 直近部屋: ${roomData.name || 'Unnamed'}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   プレイヤー: ${playerCount}人`);
        console.log(`   ステータス: ${roomData.status}`);
        
        recentRooms.push({ ...roomData, id: doc.id, playerCount });
      }
    }
    
    // 進行中の部屋を処理
    for (const doc of snapInprog.docs) {
      const roomData = doc.data();
      if (filterValid(roomData)) {
        const playersSnapshot = await doc.ref.collection('players').get();
        const playerCount = playersSnapshot.size;
        
        console.log(`\n🎮 進行中部屋: ${roomData.name || 'Unnamed'}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   プレイヤー: ${playerCount}人`);
        console.log(`   ステータス: ${roomData.status}`);
        
        if (playerCount === 0) {
          console.log(`   ⚠️  これがゴースト部屋です！`);
        }
        
        inprogRooms.push({ ...roomData, id: doc.id, playerCount });
      }
    }
    
    // 重複排除（進行中優先）
    const map = new Map();
    for (const r of recentRooms) map.set(r.id, r);
    for (const r of inprogRooms) map.set(r.id, r);
    
    const finalRooms = Array.from(map.values());
    console.log(`\n📊 最終的にロビーに表示される部屋: ${finalRooms.length} 件`);
    
    // 0人の部屋をリストアップ
    const ghostRooms = finalRooms.filter(r => r.playerCount === 0 && r.status !== 'waiting');
    if (ghostRooms.length > 0) {
      console.log(`\n🗑️  削除すべきゴースト部屋: ${ghostRooms.length} 件`);
      for (const ghost of ghostRooms) {
        console.log(`   - ${ghost.name} (ID: ${ghost.id}, Status: ${ghost.status})`);
      }
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

getExactLobbyRooms().then(() => process.exit(0));