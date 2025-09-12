#!/usr/bin/env node

// 詳細ルーム分析スクリプト - ロビーに表示される部屋の詳細情報を取得
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

async function analyzeRooms() {
  try {
    console.log('🔍 ロビー表示ルームの詳細分析...');
    
    // 直近のアクティブルーム（ロビー表示ロジックに合わせる）
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000);
    const roomsSnapshot = await db.collection('rooms')
      .where('lastActiveAt', '>=', Timestamp.fromDate(threeMinAgo))
      .orderBy('lastActiveAt', 'desc')
      .limit(5)
      .get();
    
    console.log(`📋 直近3分のアクティブルーム: ${roomsSnapshot.size} 件`);
    
    for (const doc of roomsSnapshot.docs) {
      const roomData = doc.data();
      const roomId = doc.id;
      
      // プレイヤー数をチェック
      const playersSnapshot = await doc.ref.collection('players').get();
      const playerCount = playersSnapshot.size;
      
      const now = Date.now();
      const lastActive = roomData.lastActiveAt?.toMillis() || 0;
      const ageMinutes = Math.round((now - lastActive) / (60 * 1000));
      
      console.log(`\n🏠 部屋: ${roomData.name || 'Unnamed'}`);
      console.log(`   ID: ${roomId}`);
      console.log(`   プレイヤー数: ${playerCount}`);
      console.log(`   ステータス: ${roomData.status}`);
      console.log(`   最終アクティブ: ${ageMinutes}分前`);
      console.log(`   作成日時: ${roomData.createdAt ? new Date(roomData.createdAt.toMillis()).toLocaleString() : 'unknown'}`);
      
      // 0人で進行中の部屋を特定
      if (playerCount === 0 && roomData.status && roomData.status !== 'waiting') {
        console.log(`   ⚠️  ゴースト部屋の可能性 - 0人で${roomData.status}状態`);
      }
    }
    
    // 進行中ルーム（clue/reveal）も確認
    console.log(`\n🎮 進行中ルーム分析...`);
    const inprogressSnapshot = await db.collection('rooms')
      .where('status', 'in', ['clue', 'reveal'])
      .limit(3)
      .get();
    
    console.log(`📋 進行中ルーム: ${inprogressSnapshot.size} 件`);
    
    for (const doc of inprogressSnapshot.docs) {
      const roomData = doc.data();
      const roomId = doc.id;
      
      const playersSnapshot = await doc.ref.collection('players').get();
      const playerCount = playersSnapshot.size;
      
      console.log(`\n🎯 進行中: ${roomData.name || 'Unnamed'}`);
      console.log(`   ID: ${roomId}`);
      console.log(`   プレイヤー数: ${playerCount}`);
      console.log(`   ステータス: ${roomData.status}`);
      
      if (playerCount === 0) {
        console.log(`   🗑️  削除対象のゴースト部屋`);
      }
    }
    
  } catch (error) {
    console.error('❌ 分析中にエラー:', error);
  }
}

analyzeRooms().then(() => process.exit(0));