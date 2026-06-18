# 要件定義書（抜粋）

## FR-01 工場依頼（Phase 1）
- 20号物流センターが製品数量・希望日・パレット数・箱数・貨物種別を送信
- 全依頼は `createdAt DESC` で永続保存（削除不可）

## FR-02 工場回答
- 工場は利用可能数量・パレット・箱・日付を返却
- 交渉ステータス: `FULL` | `PARTIAL` | `REJECTED`

## FR-03 交渉
- PARTIAL 時: 倉庫は Approve / Reject / Request Again
- 交渉履歴を全件保存

## FR-04 便数自動計算
- 10tトラック = **16パレット/便**
- `totalTrips = ceil(pallets / 16)`
- `remainderPallets = pallets % 16`

## FR-05 自社フリートスケジューラ（Phase 2）
- タイムラインUI（FullCalendar Resource Timeline）
- ドラッグ&ドロップで便割当
- 自社トラック優先配車

## FR-06 建会社依頼（Phase 3）
- 残便を建会社へ送信
- 建会社は便数・車両・ドライバー情報を返却
- 不足時は下請け自動分割

## FR-07 ドライバー（Phase 4）
- 極限までシンプルなモバイルUI
- 大きなカード・大きなボタン
- 現在便 / アクション / 履歴

## FR-08 到着確認（Phase 5）
- 倉庫スタッフが数量・パレット・箱・車両・ドライバーを検証
- Approve / Reject / Notes
- デジタル横持輸送依頼書・確認書

## NFR
- 日本語企業向けミニマルUI（ヤマト・佐川・Uber Freight風）
- レスポンシブ
- 全履歴永続化
