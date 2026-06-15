
# Kids Learning — AI Adaptive Learning Engine

Adaptive learning system for 5th grade math built with Claude API.

## What This Does
- 20-node TEKS-aligned skill graph (DAG) modeling prerequisite relationships
- Ebbinghaus-adapted mastery decay model — tracks skill retention over time
- Nova: Socratic tutoring agent (Claude claude-3-5-sonnet) that never gives answers directly
- Dynamic session planner — allocates problems by distance from mastery threshold

## Tech Stack
- React Native / Expo (frontend)
- Node.js / Express (backend)
- PostgreSQL (skill graph + mastery scores)
- Claude API — claude-3-5-sonnet (tutoring), claude-haiku (problem generation)
- Railway (deployment)

## Key Files
- `/skill-graph/graph.json` — 20-node TEKS skill DAG
- `/agents/nova.js` — Socratic tutor system prompt + Claude API integration
- `/session-planner/planner.js` — Dynamic weight allocation algorithm
- `/mastery/model.js` — Ebbinghaus decay scoring

## References
- Ebbinghaus, H. (1885). Memory: A Contribution to
