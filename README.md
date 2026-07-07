# 井字遊戲

一款可用手機瀏覽器操作的井字遊戲，支援：

- 單人對電腦
- 同一台裝置雙人對戰
- Firebase Realtime Database 匿名網路對戰

畫面以直式 1080 解析度與手機瀏覽器為主，會依照不同螢幕寬度縮放並置中。

## 本機開啟

最簡單的方式是直接用瀏覽器開啟 `index.html`。

如果想用本機網址測試：

```bash
npm start
```

開啟 `http://localhost:3000`。

## Firebase 設定

網路對戰需要 Firebase Realtime Database。

1. 到 Firebase Console 建立專案。
2. 新增 Web App。
3. 建立 Realtime Database。
4. 將 Firebase Web App 設定填入 `firebase-config.js`。
5. 測試模式可先使用下方規則，正式公開前建議再收緊。

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

`firebase-config.js` 範例：

```js
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

## 網路對戰流程

1. 玩家 A 選擇「真正雙人對戰：網路連線」。
2. 玩家 A 按「建立房間」，取得房號。
3. 玩家 B 開啟同一個 GitHub Pages 網址，輸入房號後按「加入房間」。
4. X 先手，雙方畫面會透過 Firebase 即時同步。

## GitHub Pages 部署

1. 將專案推到 GitHub repository。
2. 到 repository 的 `Settings` > `Pages`。
3. Source 選 `Deploy from a branch`。
4. Branch 選 `main`，資料夾選 `/root`。
5. 儲存後等待 GitHub Pages 產生網址。

此專案是靜態前端，不需要 Node 後端即可部署到 GitHub Pages。
