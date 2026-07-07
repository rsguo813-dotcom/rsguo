# Firebase 與 GitHub Pages 部署

這個版本的網路對戰使用 Firebase Realtime Database，因此可以部署在 GitHub Pages，不需要自架 Node 後端。

## Firebase

1. 建立 Firebase 專案。
2. 新增 Web App。
3. 建立 Realtime Database。
4. 將 Web App 設定填入 `firebase-config.js`。
5. 先用測試規則確認能連線，正式公開前再調整安全規則。

測試規則：

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## GitHub Pages

1. 將檔案推上 GitHub。
2. 進入 repository 的 `Settings` > `Pages`。
3. Source 選擇 `Deploy from a branch`。
4. Branch 選擇 `main`，Folder 選擇 `/root`。
5. 儲存後使用 GitHub Pages 產生的網址遊玩。

## 遊玩流程

1. 玩家 A 選擇網路對戰並建立房間。
2. 玩家 A 將房號傳給玩家 B。
3. 玩家 B 在同一個網址輸入房號並加入。
4. 雙方不需要登入，棋盤會即時同步。
