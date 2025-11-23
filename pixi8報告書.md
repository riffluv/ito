Pixi.js 8におけるVictoryRays初回未表示の原因と対策
想定される原因 (上位3～4件)

Graphics描画の初期化遅延 (シェーダーコンパイル) – Pixi 8ではPIXI.Graphicsは描画命令を蓄積するだけで、実際のジオメトリ生成やシェーダーのコンパイルは最初に画面へレンダリングされる時に行われます
pixijs.com
。高性能GPUではこの初期コストが目立ちませんが、統合GPUやモバイルGPUでは最初の描画フレームでシェーダーコンパイルとジオメトリ転送が発生し、フレーム落ちや表示遅れを引き起こします。結果としてVictoryRaysの短いアニメーションが初回だけGPU処理待ちで見えないまま終わる可能性があります（以降はシェーダーがキャッシュされるため問題発生しない）。

初期状態が不可視のためレンダリングがスキップされている – VictoryRaysの各Graphicsは初期設定でalpha=0かつscale.x=0になっており、初回のウォームアップ描画(renderOnce)時に実質的に「何も描画しない」状態でした。Pixiのレンダラーはオブジェクトが透明・ゼロスケールなら描画負荷を最小化するため実描画を省略する挙動があります。つまり最初のフレームではGraphicsのジオメトリがGPUにアップロードされず、次の勝利アニメ開始時に初めてGPU転送が走るため、低スペック環境だと描画タイミングに間に合わず表示されない結果になります
pixijs.com
。

描画タイミングのレースコンディション – アプリ起動直後の初勝利時は、Pixi HUDの初期化完了とVictoryRays生成・追加、そしてGSAPのタイムライン再生が非常に近接して起こります。低性能デバイスではHUDコンテナへの追加や初回のrequestAnimationFrame処理が遅延し、GSAPのplayExplosion()開始時にGraphics側の描画準備がまだ完了していない可能性があります。現行コードでは勝利演出タイムライン開始から0.05秒でエフェクトを表示していますが、初回のみGPU処理が追いつかず最初の数フレームが飛ばされ、結果的に何も見えないままアニメーションが終了したと考えられます。

低電力GPU特有の初動性能 – powerPreference: "low-power"指定により、初回は省電力モードでGPUクロックが低く抑えられたり、場合によってはソフトウェアレンダリングに近い環境になることがあります。特にfailIfMajorPerformanceCaveat: falseにしているため性能が著しく低い環境でもWebGLコンテキストを取得しており、初回フレームがソフトウェアレンダリング並みに遅いケースが考えられます。例えばChromeでSwiftShader（ソフトウェアGPU）が使われると描画が極端に遅く
emscripten.org
、VictoryRaysが間に合わない原因となります（2回目以降はシェーダーがキャッシュされ多少改善）。

初回描画を確実に行うための対策とコード例

1. Graphicsの事前アップロード（プリウォーム）: Pixi純正のプリペアプラグイン(renderer.plugins.prepare)を使い、VictoryRays表示前にジオメトリとテクスチャをGPUにアップロードしておきます。VictoryRays生成直後、以下のようにHUDのレンダラーへ登録します
api.pixijs.io
api.pixijs.io
:

// VictoryRaysをコンテナに追加済みとする
pixiHudRenderer.plugins.prepare.upload(pixiRaysLayer, () => {
  console.log("VictoryRays GPU準備完了");
  // 必要ならここで初回のrenderOnceやエフェクト開始を実行
});


これにより非表示のままでもバックグラウンドでGraphicsの頂点データやシェーダーがコンパイルされ、実際の再生時に初回からフレーム落ちせず描画されます
api.pixijs.io
。非同期アップロード中にUIスレッドをブロックしないため、ユーザー体験を損ねず準備できます。

2. 初期化順序と描画状態の見直し: VictoryRaysは勝利時に備えてもっと早い段階で初期化するのが理想です。例えばゲーム開始時やHUD準備完了時にcreateVictoryRays()を呼び出し、Pixiステージに追加だけしておきます（アニメ開始までは非表示にする）。可能ならVictoryRaysインスタンスを使い回し、毎回destroyせずプロパティをリセットして再利用すると、2回目以降の再コンパイルを防げます（Pixi v8ではGraphicsContextを共有すればジオメトリ再構築コストを抑えられます）。初期化時には一度だけ描画を実行してウォームアップすることも重要です。たとえば以下のように一瞬だけオブジェクトをわずかに表示してすぐ隠す工夫をします:

// 一時的に極小スケール・微小アルファで表示
rays.forEach(ray => { ray.scale.x = 0.001; ray.alpha = 0.001; });
pixiHudContext.renderOnce();  // このフレームでGPUに描画命令を送る
// 直後に元の透明状態に戻す
rays.forEach(ray => { ray.scale.x = 0; ray.alpha = 0; });


こうすることで、最初のフレームでGraphicsが実際に描画されるためジオメトリ転送とシェーダー生成が完了し、次のフレーム以降の本番アニメーションで確実に表示されます。(注意: 上記は原理実証向けです。実装ではrequestAnimationFrameやTicker.addOnceを使いフレームを跨いで非表示に戻すと良いでしょう)。

3. フレームタイミングの調整: GSAPタイムラインでのplayExplosion()呼び出しを1フレーム遅らせることも検討します。例えば初回のみ少し遅延を長めに設定し、Pixi側の描画ループと同期させます。実装上は、VictoryRays表示前にrequestAnimationFrame(() => playExplosion())で次フレームまで開始を遅延させる方法があります。ただし、上記プリウォームと初期描画を正しく行えば原則タイミング調整なしで問題解消可能です。

軽量な検証ステップ (修正確認方法)

実機での目視確認: 修正後、問題が発生していた低スペックデバイス（統合GPU搭載PCや対象のモバイル端末）でアプリを初回起動し、最初の勝利演出でVictoryRaysが正しく表示されるか目視確認します。フリッカーや描画遅延がなければ成功です。

パフォーマンス計測 (簡易): 開発ビルドで、VictoryRays再生開始から終了までの時間を計測し、期待するGSAPアニメ時間と大きくずれていないことを確認します（例えばperformance.mark()とperformance.measure()で測定し、ログを1回出力する程度）。初回でもタイムライン通りの長さでアニメが完了していれば、途中フレーム落ちがなく描画された証拠になります。

描画呼び出し数のモニタ: PixiJS開発者ツールやRendererのメトリクスを利用できる場合、VictoryRays再生フレームでのDraw Call数が0になっていないことを確認します（例：PixiJS DevtoolsのStatisticsタブで初回エフェクト時のdrawCallsが増加しているかチェック）。これによりGraphicsが実際にレンダリングパイプラインに乗ったことを裏付けできます。ログ出力を多用せず、必要最低限の指標のみ確認してください。

WebGL劣化時のフォールバック条件と方法

特定デバイスでどうしてもWebGL描画が安定しない場合は、SVGや静的画像によるフォールバック表示を検討します。以下の条件で自動フォールバックするのがベストプラクティスです:

主要なパフォーマンス劣化の検出: アプリ起動時に一度、failIfMajorPerformanceCaveatフラグ付きでWebGLコンテキストを試行し、取得に失敗した場合（つまりブラウザが「著しく低速なGPU環境」と判断
emscripten.org
）はWebGLによるVictoryRays描画を諦めます。実装例:

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
const isLowPerformance = !gl;
if (isLowPerformance) {
  USE_PIXI_RAYS = false;  // このフラグでVictoryRaysではなくSVGエフェクトを使う
}


ソフトウェアレンダリングの検出: 一部ブラウザでは拡張機能WEBGL_debug_renderer_infoでレンダラ名を取得できます。gl.getParameter(UNMASKED_RENDERER_WEBGL)に「SwiftShader」「Software Rasterizer」などが含まれる場合はGPU非搭載またはドライバ問題によるソフトウェア実行と判断し、フォールバックします。

以上の条件にマッチした場合のみ、PixiによるVictoryRays描画をスキップして代替SVGアニメーションを表示するようにします。フォールバック実装時は、該当デバイスではPixi側でVictoryRays用コンテナを生成しない・更新しないことで無駄な負荷を避けてください。こうした明確な判定に基づきWebGLエフェクトを出さないことで、ユーザー体験を損ねずに済みます。