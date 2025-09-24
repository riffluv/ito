# Debug Test Log

今回のテスト専用ログファイル

## テスト手順
1. このファイルを開いておく
2. Edge で入退室テストを実行
3. コンソールログをここにコピペ
4. 問題を特定

---

## ログはここにペースト:
}
[Server] NON-HOST LEAVING - no host change needed {
  roomId: 'SXUYF3YYBLiefDDqRusV',
  userId: 'fZsQi4LS2Ogrif3v8x7OreIdjmu2',
  currentHost: '66LT5TfKPpYpIrgf6bxaxSXfBlP2'
}
[Server] Leave completed: { roomId: 'SXUYF3YYBLiefDDqRusV', uid: 'fZsQi4LS2Ogrif3v8x7OreIdjmu2' }
 POST /api/rooms/SXUYF3YYBLiefDDqRusV/leave 200 in 373ms
[Server] Leave request: {
  roomId: 'SXUYF3YYBLiefDDqRusV',
  uid: 'fZsQi4LS2Ogrif3v8x7OreIdjmu2',
  displayName: 'シークレット',
  timestamp: '2025-09-24T15:01:31.329Z'
}
[Server] Players array check: {
  roomId: 'SXUYF3YYBLiefDDqRusV',
  userId: 'fZsQi4LS2Ogrif3v8x7OreIdjmu2',
  origPlayers: [],
  filteredPlayers: [],
  actualPlayerIds: [ '4jrGOFSKygYbS8ichOcZEKFhiKE3', '66LT5TfKPpYpIrgf6bxaxSXfBlP2' ],
  dealExists: false,
  dealPlayers: undefined
}
[Server] Host exit check: {
  roomId: 'SXUYF3YYBLiefDDqRusV',
  userId: 'fZsQi4LS2Ogrif3v8x7OreIdjmu2',
  roomHostId: '4jrGOFSKygYbS8ichOcZEKFhiKE3',
  isHostLeaving: false,
  filteredPlayersCount: 0,
  actualRemainingCount: 2
}
[Server] NON-HOST LEAVING - no host change needed {
  roomId: 'SXUYF3YYBLiefDDqRusV',
  userId: 'fZsQi4LS2Ogrif3v8x7OreIdjmu2',
  currentHost: '4jrGOFSKygYbS8ichOcZEKFhiKE3'
}
[Server] Leave completed: { roomId: 'SXUYF3YYBLiefDDqRusV', uid: 'fZsQi4LS2Ogrif3v8x7OreIdjmu2' }
 POST /api/rooms/SXUYF3YYBLiefDDqRusV/leave 200 in 283ms
