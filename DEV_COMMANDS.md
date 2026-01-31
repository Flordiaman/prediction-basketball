\# Blurift – dev commands (known-good)



\## Frontend

npm --prefix web run dev -- --port 5173 --strictPort



\## Backend

node src/server.js



\## Quick checks

\# player search

curl "http://localhost:3001/api/nba/db/players/search?q=le\&limit=10"



\# player last games

curl "http://localhost:3001/api/nba/db/player/2544?limit=25"



\# db tables

curl "http://localhost:3001/api/nba/\_debug/tables"



