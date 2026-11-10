# 我的電子衣櫃

手機、電腦都能用的個人衣櫃網站：拍照新增衣服、標記常穿或不穿、存搭配、整理待處理和購物清單，並依每月流行趨勢比對衣櫃給推薦。

- 網站：GitHub Pages（靜態檔案）
- 登入、資料、照片：Supabase（每個人只能看到自己的資料，照片存在私人空間）
- 趨勢：`trends.json`，每月自動更新

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html`、`style.css`、`app.js` | 網站本體 |
| `config.js` | Supabase Project URL 和 anon public key |
| `trends.json` | 當月趨勢，推薦頁讀這個檔案 |
| `supabase-setup.sql` | 第一次設定資料庫時，在 Supabase SQL Editor 執行一次 |

## trends.json 格式

```json
{
  "updated": "YYYY-MM-DD",
  "season": "2026 秋冬",
  "summary": "一段總結",
  "trends": [
    {
      "id": "英文代號",
      "title": "趨勢名稱",
      "desc": "說明",
      "petite": "150 公分小個子的穿法重點",
      "pieces": [
        {"label": "單品名稱", "cat": "類別或類別陣列", "colors": ["顏色，空陣列代表任何顏色"]}
      ]
    }
  ],
  "sources": [{"title": "來源標題", "url": "https://..."}]
}
```

`cat` 只能用：背心、上衣、針織／開衫、外套、褲子、裙子、洋裝、鞋子、包包、配件。
`colors` 只能用：黑、灰、白、藏藍、咖啡、米杏、粉、藍、綠、條紋、格紋、花色。
