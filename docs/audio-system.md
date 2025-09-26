# オンラインITO サウンドシステムガイド (2025-09-27 更新)

## 概要
- `SoundProvider` ( `@/lib/audio/SoundProvider` ) がクライアント全体に Web Audio ベースの `SoundManager` を提供します。
- `SoundManager` は `public/sfx` 配下の効果音ファイルを自動解決し、未配置の場合は安全にスキップします。
- グローバル関数 `playSound(soundId)` (`@/lib/audio/playSound`) で任意の場所から即時再生できます。
- React からは `useSoundEffect(soundId)` でフック化された関数を取得できます。
- 現在の対象イベントは以下のとおりです。
  - UIボタン: `ui_click`
  - DnD ピックアップ/ドロップ: `drag_pickup`, `drop_success`, `drop_invalid`
  - 並び確定: `order_confirm`
  - カードめくり: `card_flip`
  - リザルト: `result_victory`, `result_failure`
  - 通知トースト: `notify_success`, `notify_warning`, `notify_error`

## アセット配置
- ルート: `public/sfx`
- 拡張子は `webm`, `ogg`, `mp3`, `wav` の優先順で探索します（ファイル名に拡張子を含めてもOK）。
- 推奨ディレクトリ構成 (空の場合は `.gitkeep` のみ):
  - `public/sfx/ui/ui_click.(webm|ogg|mp3|wav)`
  - `public/sfx/card/card_flip.*`
  - `public/sfx/dnd/drag_pickup.*`, `drop_success.*`, `drop_invalid.*`
  - `public/sfx/notify/notify_success.*`, `notify_error.*`, `notify_warning.*`
  - `public/sfx/result/result_victory.*`, `result_failure.*`
  - `public/sfx/system/order_confirm.*`, `round_start.*`

アセットが未配置でもアプリは正常に動作し、コンソールに警告を出しつつ無音でフォールバックします。

## パラメータ調整
- `lib/audio/registry.ts` 内でサウンド定義を管理しています。
  - `playbackRateRange`, `gainDbRange`, `startOffsetMsRange` で微妙なランダマイズを付与。
  - `variants` に複数パスを指定すると確率重み (`weight`) を付けてバリエーション再生が可能。
- マスターボリュームやカテゴリ別 (`ui`, `drag`, `notify` など) の音量は `localStorage` (`ito:sound:settings:v1`) に保存され、`SoundManager` の API から更新可能です（UI未実装）。

## 実装ハイライト
- `SoundProvider` が初期化時に `SoundManager` を生成し、ブラウザ解錠イベント（pointerdown/keydown/touchstart）で AudioContext を解錠します。
- サウンド再生は `play(soundId, overrides)` で非同期デコード → GainNode チェーン構築 → 再生という流れ。
- 未再生アセットは `fetch(..., { cache: "force-cache" })` で取得し `decodeAudioData` の結果をメモリ/永続マップにキャッシュ。
- `SoundManager` は visibilitychange に応じて自動で `suspend`/`resume` を実行。
- `SoundManager.subscribe` で設定変更やアセット欠落通知をキャッチできます（今後UI化想定）。

## 開発者向けメモ
- 追加サウンドを扱う場合は `lib/audio/types.ts` の `SoundId` と `registry.ts` に定義を追記してください。
- コード内で新規イベントに効果音を付ける場合は `useSoundEffect("sound_id")` または `playSound("sound_id")` を利用してください。
- ローカルで音声が鳴らない場合はブラウザコンソールに `SoundManager` の警告が出力されます（未解錠 / アセット欠落 / decode失敗 など）。
- SSR 安全性のため `SoundProvider` は `ClientProviders` 内（クライアントコンポーネント）でのみ使用しています。

## TODO / 拡張案
- UI設定（ミュート・音量スライダー）の追加。
- BGM/アンビエントサポート (`ambient` カテゴリ) の導入。
- ユーザーキャッシュのサイズ制御やプリロード戦略のチューニング。
- Storybook でのサウンド再生モック化（今はブラウザ動作限定）。
