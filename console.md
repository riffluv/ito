hot-reloader-client.js:99 コンソールを消去しました
hydration-error-info.js:63 ./lib/game/topicControls.ts
Error: 
  × Unexpected token `,`. Expected identifier, string literal, numeric literal or [ for the computed key
    ╭─[C:\Users\hr-hm\Desktop\codex\lib\game\topicControls.ts:57:1]
 57 │     } catch (error: any) {
 58 │       notify({ title: "ゲームリセットに失敗", description: error?.message || String(error), type: "error" });
 59 │     }
 60 │   },,
    ·     ─
 61 │ 
 62 │   // 現在のカテゴリでお題をシャッフル
 62 │   async shuffleTopic(roomId: string, currentCategory: string | null) {
    ╰────

Caused by:
    Syntax Error
console.error @ hydration-error-info.js:63
content.js:85 [VSC] Content script initialized
