# Enterprise TMS Architecture

## System Flow

```
Maruichi Warehouse
    → Create Delivery (products, weight, volume)
    → Auto Truck Suggestion Algorithm
    → Shinwa Receives (SSE notification)
    → Accept / Split Cargo / Forward Subcontractor
    → Assign Truck + Driver
    → Driver Dispatches (GPS tracking starts)
    → Live Map (30s GPS pings)
    → Arrive → Generate QR Code
    → Customer scans /delivery/confirm/[token]
    → Approve + POD (signature/photo)
    → DELIVERED
```

## GPS Tracking Architecture

```
Driver Mobile App
    → POST /api/gps (every 30s)
    → recordGpsPosition() server action
    → GpsHistory table (RDS)
    → Driver.currentLat/Lng updated
    → progressPercent calculated
    → SSE emit GPS_UPDATE to warehouse dashboard
    → LiveTrackingMap (Leaflet + OSM tiles)
```

## Truck Assignment Algorithm

Location: `lib/tms/truck-assignment.ts`

1. Sort trucks by capacity ascending
2. If single truck fits weight AND volume → assign smallest suitable truck
3. Else greedy multi-truck: fill with largest trucks, remainder with smaller
4. Split delivery: `planDeliverySplit()` divides by carrier capacity

## Route Calculation

Location: `lib/tms/routing.ts`

- Primary: OpenRouteService API (`OPENROUTESERVICE_API_KEY`)
- Fallback: Haversine distance × 1.3 road factor + interpolated polyline
- Geocoding: ORS geocode with Japan boundary filter
- Demo fallback: `JAPAN_LOCATIONS` keyword matching

## QR Delivery Confirmation

1. Driver taps "Generate QR" → `POST /api/delivery/[id]/qr`
2. Token stored in `DeliveryConfirmation` (48h expiry)
3. QR encodes URL: `/delivery/confirm/[token]`
4. Customer approves → `POST /api/delivery/confirm/[token]`
5. Status → DELIVERED, POD saved, SSE notification

## Real-Time (SSE)

`lib/sse/index.ts` — in-memory pub/sub per company/user

Events: `GPS_UPDATE`, `TRUCK_ASSIGNED`, `DELIVERY_SPLIT`, `CUSTOMER_CONFIRMED`

Production upgrade: Redis Pub/Sub or API Gateway WebSocket + Lambda

## AWS Architecture

| Service | Purpose |
|---------|---------|
| RDS PostgreSQL | All TMS data, GPS history |
| S3 | POD photos, signatures |
| Amplify | Next.js SSR hosting |
| Lambda | GPS batch processing (optional) |
| Secrets Manager | DB credentials, API keys |
| CloudWatch | Logs, alarms |
| CDK | Infrastructure as Code |

## Environment Variables

```env
OPENROUTESERVICE_API_KEY=   # Route + geocoding
NEXTAUTH_URL=
DATABASE_URL=
AWS_S3_BUCKET_NAME=
```

## Production Best Practices

1. Enable RDS Multi-AZ + RDS Proxy for connection pooling
2. Partition `GpsHistory` by month for large fleets
3. Rate-limit `/api/gps` to 1 req/30s per driver
4. Use CloudFront for S3 POD assets
5. Rotate QR tokens after use
6. Enable WAF on Amplify for public `/delivery/confirm` routes
7. CloudWatch alarm on GPS gap > 5 minutes during IN_TRANSIT
