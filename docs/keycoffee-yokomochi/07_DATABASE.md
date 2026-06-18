# Database Design — Key Coffee Yokomochi

## Core Models (Prisma)

| Model | Phase | Purpose |
|-------|-------|---------|
| `YokomochiOrder` | All | Parent order — never deleted |
| `FactoryRequest` | 1 | Warehouse → Factory |
| `FactoryResponse` | 1 | Factory reply (FULL/PARTIAL/REJECTED) |
| `NegotiationHistory` | 1 | All negotiation actions |
| `YokomochiTrip` | 1-4 | Auto-calculated trips (16 pallets/10t) |
| `InternalFleetAssignment` | 2 | Own truck + driver per trip |
| `DriverSchedule` | 2 | Timeline scheduler slots |
| `CarrierRequest` | 3 | Remaining trips → 建会社 |
| `CarrierResponse` | 3 | Carrier capacity reply |
| `YokomochiSubcontractAssignment` | 3 | Subcontract split |
| `DriverTask` | 4 | Driver mobile execution |
| `DeliveryVerification` | 5 | Warehouse arrival check |
| `YokomochiDeliveryForm` | 5 | Digital 横持輸送依頼書/確認書 |

## Trip Formula

```
totalTrips = ceil(pallets / 16)
remainderPallets = pallets % 16
```

## Completion Rule

```
COMPLETED ⇔ Driver ARRIVED_WAREHOUSE ∧ Warehouse Verification APPROVED
```

## Setup

```bash
npx prisma db push
npm run db:seed
```
