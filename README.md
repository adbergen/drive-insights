# Drive Insights

A full-stack application that connects to Google Drive, syncs file metadata to a local PostgreSQL database, and provides an AI-powered question interface for analyzing file data.

## Tech Stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** Vue 3 + Vite + Vuetify
- **Database:** PostgreSQL
- **Monorepo:** pnpm workspaces

## Getting Started

### Prerequisites

- Node.js >= 24
- pnpm >= 10
- Docker (for PostgreSQL)

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd drive-insights

# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up -d

# Copy environment variables
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and OPENAI_API_KEY

# Start development servers
pnpm dev
```

- **Server:** http://localhost:3000
- **Client:** http://localhost:5173
- **Health check:** http://localhost:3000/api/health


## License

MIT
