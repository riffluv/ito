ウェブアプリ
ito-web
ウェブアプリ
アプリのニックネーム
ito-web
アプリ ID
1:374128501058:web:ae672cc7dc71a60c4e28db
SDK の設定と構成

npm

CDN

Config
npm とモジュール バンドラ（webpack や Rollup など）をすでに使用している場合は、次のコマンドを実行して最新の SDK をインストールできます。（詳細）。

npm install firebase
次に Firebase を初期化し、使用するプロダクトの SDK の利用を開始します。

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC6AZfNZYB8R53laqA9SyOrFqIe0U8Cnxs",
  authDomain: "online-ito.firebaseapp.com",
  projectId: "online-ito",
  storageBucket: "online-ito.firebasestorage.app",
  messagingSenderId: "374128501058",
  appId: "1:374128501058:web:ae672cc7dc71a60c4e28db",
  measurementId: "G-WV2ZJ6CP5H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
注: このオプションではモジュラー JavaScript SDK を使用します。これにより SDK のサイズが小さくなります。

ウェブ向け Firebase の詳細については、こちらをご覧ください: 使ってみる、 ウェブ SDK API リファレンス、 サンプル

