# Firebaseエミュレーター起動手順

ローカルで Firebase (Firestore / Authentication / Realtime Database) を安全にテストするときの手順をまとめました。NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true を設定していると、以下のエミュレーターに接続されます。

## 事前準備

1. **Java (JDK 17)** をインストール
   - 例: [Temurin 17](https://adoptium.net/temurin/releases/?variant=openjdk17)
   - インストール後 java -version が表示されることを確認

2. **Firebase CLI** をインストール
   `powershell
   npm install -g firebase-tools --location=global
   `
   - irebase --version が表示されれば OK

3. PATH に次のフォルダが含まれていることを確認
   - C:\Program Files\Eclipse Adoptium\jdk-17.x.x+xx\bin
   - C:\home\hr-hm\.npm-global

## .env.local の設定

開発中は .env.local に次の行を入れておく。

`
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true
NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=localhost
NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT=8080
NEXT_PUBLIC_AUTH_EMULATOR_HOST=localhost
NEXT_PUBLIC_AUTH_EMULATOR_PORT=9099
NEXT_PUBLIC_DATABASE_EMULATOR_HOST=localhost
NEXT_PUBLIC_DATABASE_EMULATOR_PORT=9000
`

本番 Firebase を使いたいときは NEXT_PUBLIC_FIREBASE_USE_EMULATOR をコメントアウトするか alse に変更し、Next.js を再起動する。

## 起動手順

1. **エミュレーターを起動**
   `powershell
   firebase emulators:start
   `
   - 初回は Firestore/Auth/RTDB のエミュレータをダウンロードするので少し時間がかかる。
   - Emulator UI: http://127.0.0.1:4000

2. **別のターミナルで開発サーバーを起動**
   `powershell
   npm run dev
   `

3. ブラウザで http://localhost:3000 を開いて動作確認。
   - Firestore へのアクセスは http://localhost:8080 に、Auth は http://localhost:9099 に向く。
   - Emulator UI の Firestore / Auth 画面でデータが反映されていることを確認すると安全。

## よくある確認方法

- エミュレーターのターミナルにアクセスログが流れているか
- Emulator UI で ooms や players のドキュメントが作成されているか
- DevTools の Network タブで Firestore のリクエスト先が localhost:8080 になっているか
- 本番 Firebase コンソールには影響していないか

## 停止方法

- エミュレーターや 
pm run dev を止めるときは、各ターミナルで Ctrl + C を押す。
- エミュレーターを停止するとローカルデータは消える（必要ならエミュレーターのデータ保存を設定する）。

以上！これで開発環境と本番環境を安全に切り分けられます。
