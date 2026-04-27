# Clawborate Community Edition

Clawborate is a platform for creating and managing collaborative AI agent teams. Define agent roles, assign tasks through a coordinator, and watch your team work together — each agent has its own identity, memory, and specialization.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (:3000)                                        │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  Nginx                                                  │
│  ├── /          → Frontend (Next.js)                    │
│  ├── /api/      → Backend                               │
│  └── /ow/       → Open WebUI (chat interface)           │
└──────┬─────────────────┬────────────────────┬───────────┘
       │                 │                    │
┌──────▼───────┐  ┌──────▼───────┐  ┌────────▼──────────┐
│  Frontend    │  │  Backend     │  │  Open WebUI       │
│  (Next.js)   │  │  (Python)    │  │  (chat UI)        │
└──────────────┘  └──────┬───────┘  └───────────────────┘
                         │
               ┌─────────▼─────────┐
               │  PostgreSQL       │
               └─────────┬─────────┘
                         │
          ┌──────────────▼──────────────┐
          │  Agent Containers           │
          │  ┌────────┐ ┌────────┐      │
          │  │Agent 1 │ │Agent 2 │      │
          │  └────────┘ └────────┘      │
          │  ┌────────┐ ┌────────┐      │
          │  │Agent 3 │ │Agent N │      │
          │  └────────┘ └────────┘      │
          └─────────────────────────────┘
```

**Backend** manages teams, spawns agent containers via Docker API, and bridges chat between users and agents.

**Agent containers** are independent runtime instances, each with its own LLM connection, identity, and workspace. Agents communicate through a shared notification bus.

### Supported Agent Runtimes

- [x] **OpenClaw** — general-purpose agent runtime
- [ ] **Hermes** — coming soon
- [ ] **Claude** — coming soon

**Open WebUI** provides the chat interface — users talk to agents through it, and agent replies are routed back through the backend.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An LLM API key (Anthropic, OpenAI, or any OpenAI-compatible endpoint)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/sammyhuang/clawborate-community.git
cd clawborate-community

# 2. Create your environment file
cp .env.example .env

# 3. Edit .env — at minimum, set these:
#    APP_DB_PASSWORD   — database password (generate a random one)
#    JWT_SECRET        — auth token secret (generate a random one)
#    LLM_BASE_URL      — your LLM API endpoint
#    LLM_API_KEY       — your LLM API key
#    LLM_MODEL         — model name (e.g. claude-sonnet-4-20250514)

# 4. Start everything
docker compose up -d
```

Generate secure passwords:
```bash
python3 -c "import secrets; print(secrets.token_hex(16))"   # APP_DB_PASSWORD
python3 -c "import secrets; print(secrets.token_hex(32))"   # JWT_SECRET
```

### First Login

Open http://localhost:3000 and log in with the default credentials:

- **Email:** `test@test.com`
- **Password:** `test`

(Change these in `.env` via `DEFAULT_USER_EMAIL` / `DEFAULT_USER_PASSWORD` before first run.)

### Create a Team

1. Go to **Teams** and click **Create Team**
2. Select the **ACE Development Team** template (4 agents: coordinator, developer, designer, tester)
3. Wait for all agent containers to start (health checks turn green)
4. Go to **Settings > LLM** and configure your API key, then click **Save and Apply**
5. Start chatting with your team through the coordinator

## Configuration

All configuration is in `.env`. See `.env.example` for the full list of options.

### LLM Providers

| Provider | Variables to set |
|----------|-----------------|
| Anthropic | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` |
| OpenAI | `LLM_PROVIDER=openai`, `OPENAI_API_KEY` |
| Ollama (local) | `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://host.docker.internal:11434` |
| Custom | `LLM_PROVIDER=custom`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` |

LLM settings can also be configured after startup via the **Settings** page in the UI.

## Customizing Agents

Agent definitions live in `agent-arch/openclaw/`. Each agent has an identity, personality, and memory that you can edit. See [agent-arch/README.md](agent-arch/README.md) for details.

## Managing the Stack

```bash
# View logs
docker compose logs -f backend

# Restart
docker compose restart

# Stop
docker compose down

# Full reset (wipes all data)
docker compose down -v
```

## License

Community edition. See [LICENSE](LICENSE) for details.
