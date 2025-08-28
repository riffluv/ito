# Serena MCP × Codex CLI セットアップ

- 目的: Codex CLI から Serena MCP を起動・利用できるようにする
- 対応範囲: 本リポジトリ内の `.codex/config.toml` に Codex 用MCP設定を追加（Claude Code設定は未変更）

## 使い方
- Codex CLI セッションで Serena のツールを呼ぶと自動で `uvx … serena start-mcp-server --context codex` が起動します。
- プロジェクト固有設定は `.serena/project.yml` を使用します（既存）。

## 事前要件
- `uvx` が利用可能であること（`uvx --version` で確認）

## 参考
- Serena README（Codex向け設定例）
- MCP 概要とクライアント実装例（Claude Desktop ドキュメント）
