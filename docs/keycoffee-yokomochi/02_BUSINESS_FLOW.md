# 業務フロー図（5 Phases）

## Phase 1 — 工場依頼・回答・交渉

```
Warehouse                    Factory
    │                            │
    │── FactoryRequest ─────────►│  (数量・パレット・箱・希望日)
    │                            │
    │◄── FactoryResponse ────────│  (FULL / PARTIAL / REJECTED)
    │                            │
    │── Negotiation ────────────►│  (Approve / Reject / Request Again)
    │                            │
    │◄── NegotiationHistory ─────│  (全履歴保存・削除なし)
    │                            │
    ▼
自動便数計算: ceil(パレット ÷ 16) = 総便数 (10tトラック)
```

## Phase 2 — 自社フリート配車

```
Warehouse Scheduler (Timeline UI)
    │
    ├─ Truck A (10t) + 小野 → Trip 1, Trip 2
    ├─ Truck B (10t) + 浅川 → Trip 1, Trip 2
    │
    ▼
残便 → Phase 3 へ
```

## Phase 3 — 建会社・下請け

```
Warehouse ── CarrierRequest ──► Carrier
                │
                ◄── CarrierResponse (便数・車両・ドライバー・集荷予定)
                │
        不足分 ──► SubcontractRequest ──► Subcontractor A, B...
```

## Phase 4 — ドライバー実行

```
Driver Dashboard (Mobile First)
    Arrived Factory → Loaded → Start Delivery → Arrived Warehouse → Complete
```

## Phase 5 — 倉庫到着確認

```
Driver [ARRIVED] ──► Warehouse Verification
                         │
                    Approve / Reject + Notes
                         │
                    DeliveryConfirmation (横持輸送依頼書・確認書デジタル化)
                         │
                    Status = COMPLETED
```

## 完了条件

**Driver Arrived AND Warehouse Verified** → のみ `COMPLETED`
