# Skill: social-monitor

目標：Social Monitor 模組完整功能實作

## 必須路由

- `/social-monitor/posts` - 貼文列表與篩選
- `/social-monitor/trends` - 趨勢關鍵字
- `/social-monitor/stats` - 統計概覽
- `/social-monitor/keywords` - 關鍵字管理
- `/social-monitor/notifications` - 通知設定

## Posts 篩選器（必須支援）

- platform (all/facebook/instagram/twitter/ptt/line)
- minUrgency (1-10)
- keyword (text search)
- sentiment (positive/negative/neutral)
- location (text search)
- from/to (date range)
- minLikes/minComments/minShares/minViews

## 匯出功能

- CSV 格式
- JSON 格式

## 通知頻道

- Telegram
- LINE Notify
- Webhook
- Email
- Slack
