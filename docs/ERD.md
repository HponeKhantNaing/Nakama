# Enterprise TMS — Database ERD

```mermaid
erDiagram
    Company ||--o{ User : employs
    Company ||--o{ Warehouse : owns
    Company ||--o{ Truck : owns
    Company ||--o{ Driver : employs
    Company ||--o{ TransportRequest : creates
    Company ||--o{ DeliverySplit : handles

    Warehouse ||--o{ TransportRequest : ships_from
    Customer ||--o{ TransportRequest : receives

    TransportRequest ||--o{ DeliveryItem : contains
    TransportRequest ||--o| TripAllocation : assigned
    TransportRequest ||--o| DeliveryConfirmation : qr
    TransportRequest ||--o| ProofOfDelivery : pod
    TransportRequest ||--o{ GpsHistory : tracked
    TransportRequest ||--o{ DeliverySplit : split_into
    TransportRequest ||--o{ TransportRequest : parent_child

    Product ||--o{ DeliveryItem : line_item

    Truck ||--o{ TripAllocation : used_by
    Driver ||--o{ TripAllocation : drives
    Driver ||--o{ GpsHistory : pings

    TransportRequest {
        string id PK
        string requestNo UK
        float cargoWeight
        float cargoVolume
        enum priority
        enum status
        float originLat
        float originLng
        float destLat
        float destLng
        string routePolyline
        float progressPercent
    }

    Product {
        string id PK
        string sku UK
        float unitWeight
        float unitVolume
        bool fragile
        bool temperatureControlled
    }

    Truck {
        string id PK
        string truckNumber UK
        enum truckType
        float capacityWeightKg
        float capacityVolumeM3
        enum status
    }

    Driver {
        string id PK
        enum status
        float currentLat
        float currentLng
        float rating
    }

    GpsHistory {
        string id PK
        float latitude
        float longitude
        float speed
        datetime recordedAt
    }

    DeliveryConfirmation {
        string token UK
        datetime approvedAt
        string customerIp
    }
```

## Key Relationships

| From | To | Cardinality | Description |
|------|-----|-------------|-------------|
| TransportRequest | DeliveryItem | 1:N | Product line items |
| TransportRequest | TripAllocation | 1:1 | Truck + driver assignment |
| TransportRequest | DeliverySplit | 1:N | Shinwa vs subcontractor cargo |
| Driver | GpsHistory | 1:N | 30-second GPS pings |
| TransportRequest | DeliveryConfirmation | 1:1 | QR customer approval |
