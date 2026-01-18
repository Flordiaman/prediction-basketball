```md
# Prediction Basketball – ERD

```mermaid
erDiagram
  MARKETS ||--o{ SNAPSHOTS : has
  EVENTS  ||--o{ SNAPSHOTS : has
  TRACKED_SLUGS ||--o{ SNAPSHOTS : collects

  MARKETS {
    string slug PK
    string title
    string league
    string sportsMarketType
    string start_time
    string end_time
    string updated_at
    string raw_json
  }

  EVENTS {
    string event_slug PK
    string series_slug
    string event_date
    string start_time
    int    game_id
    string raw_json
  }

  TRACKED_SLUGS {
    string slug PK
    int    enabled
    string created_at
    string notes
  }

  SNAPSHOTS {
    int    id PK
    string slug FK
    string ts
    int    live
    int    ended
    string period
    string elapsed
    string score
    float  best_bid
    float  best_ask
    float  last_trade
    string outcome_prices_json
    string raw_json
  }

graph TD
  A --> B
