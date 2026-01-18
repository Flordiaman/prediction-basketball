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

flowchart TB
  Top[Top Bar: League (NBA) | Global Search | Collector Status Pill | Start/Stop | Settings]
  Top --> L[Left Column]
  Top --> R[Right Column]

  subgraph L[Left Column]
    A1[Tracked Slugs\n- add slug\n- tags\n- enable/disable\n- notes]
    A2[Collector Config\n- everySec\n- batch size\n- last run\n- last errors]
    A3[Quick Actions\n- add selected\n- export\n- backup DB]
  end

  subgraph R[Right Column]
    B1[Today / Upcoming Games\nTable: start time | matchup | best bid/ask | last | live?]
    B2[Selected Market Card\nTitle\nScore/Period/Clock\nbest bid/ask/last\nopen/closed]
    B3[Charts\nPrice vs time\nSpread vs time\nMomentum (later)]
    B4[Recent Snapshots\nSortable table + CSV export]
  end
flowchart LR
  D[Dashboard] --> E[Market Explorer]
  E --> M[Market Detail]
  D --> C[Collector Admin]
  D --> B[Backtest / Compare]
  C --> M
  E --> C

  E:::page
  D:::page
  M:::page
  C:::page
  B:::page

  classDef page fill:#0e1426,stroke:#3a4b86,color:#e6e9f7,stroke-width:1px;
