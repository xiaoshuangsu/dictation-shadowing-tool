#!/bin/bash
npm run dev 2>&1 &
sleep 8
curl -s "http://localhost:3000/api/vocabulary-words?category=oxford-3000&limit=15&offset=0"
pkill -f "next dev"
