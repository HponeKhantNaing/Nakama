# Screen Design — Key Coffee Yokomochi (仮)

## Warehouse (20号物流センター)

| Screen | Route | Components |
|--------|-------|------------|
| Factory Requests | `/warehouse/factory-requests` | Accordion list + create form |
| Negotiations | `/warehouse/negotiations` | Accordion + Approve/Reject/Request Again |
| Internal Fleet | `/warehouse/internal-fleet` | Timeline scheduler + trip assign |
| External Carrier | `/warehouse/external-carrier` | Phase 3 placeholder |
| Subcontractors | `/warehouse/subcontractors` | Phase 3 placeholder |
| Delivery History | `/warehouse/history` | Completed orders accordion |

## Factory (飲料工場)

| Screen | Route |
|--------|-------|
| Incoming Requests | `/factory/requests` |
| Response Form | Expand accordion row |

## Carrier (建会社)

| Screen | Route |
|--------|-------|
| New Requests | `/carrier/requests` |
| Accepted Jobs | `/carrier/accepted` (planned) |
| Subcontract | `/carrier/subcontract` (planned) |

## Driver

| Screen | Route | UX |
|--------|-------|-----|
| Active Trip | `/driver/active-job` | Large card, one primary action button |
| History | `/driver/history` | Past trips list |

## Design Language

- Japanese enterprise minimal (Yamato / Sagawa inspired)
- White cards, muted borders, accordion rows
- Mobile-first driver UI
