# Agent Architecture

This directory contains agent definitions, team templates, and runtime configuration used by the Clawborate backend to create and manage AI agent teams.

## Structure

```
agent-arch/
└── openclaw/
    ├── runtime.json              # Container runtime config (image, ports, env mapping)
    ├── base/                     # Base scripts (auto-pairing daemon)
    ├── agents/                   # Agent definitions
    │   ├── coordinator/          # Team coordinator (master agent)
    │   ├── developer/            # Full-stack developer
    │   ├── designer/             # UI/UX designer
    │   └── tester/               # QA engineer
    ├── teams/                    # Team templates
    │   └── ace/                  # Default 4-agent development team
    └── extensions/partials/      # System instruction extensions
```

## Customizing Agents

Each agent directory contains:

- `agent.json` — metadata (name, role, description)
- `IDENTITY.md` — agent identity and responsibilities
- `SOUL.md` — personality and values
- `MEMORY.md` — initial memory scaffold

Edit these files to customize agent behavior. Changes take effect on the next team creation. The directory is mounted read-only into the backend container.

## Pluggable Agent Framework (PAF)

Agent definitions follow the [Pluggable Agent Framework](https://github.com/sammyhuang/pluggable-agent-framework) specification. PAF assembles system instructions from numbered partials (base + extensions) into a single document for each agent.

To create custom agents or teams, see the PAF documentation:

```bash
pip install pluggable-agent-framework
```
