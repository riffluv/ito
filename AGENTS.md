## 基本ポリシー（2025-08-28 更新）

- すべての回答は日本語で行う。
- Web検索は Codex CLI 内蔵の WebSearch（ビルトイン）を既定で使用する。
- 外部CLI（`gemini -p` や `brave-search`/`brave`）は使用しない。必要時も呼び出さない。
- 例外: ユーザーが明示的に外部CLIの利用を求めた場合のみ実施。

## Web検索の実行ルール

- まず内蔵の WebSearch を使用する。
- 外部CLIやMCP経由の検索へのフォールバックは禁止。
- 参照元は回答内で明示（出典URLまたはツールの結果参照）。

## External MCP servers

- name: serena
  mcp: http://127.0.0.1:24282
  description: "Serena MCP server running locally"
