# renamer

ブラウザで動くファイル一括リネームツール（PWA）。`public/` を Cloudflare Workers の静的アセットとして配信。

## テスト

```
cd public && python3 -m http.server 8765 &
node test/e2e.js
```
