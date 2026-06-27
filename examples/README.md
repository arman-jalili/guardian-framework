# Guardian Framework — Quickstart Example

This example shows the complete lifecycle of using Guardian Framework to set up an AI-assisted development environment for a new project.

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- A GitHub or GitLab account

## Step 1: Initialize a project

```bash
# Create a new project directory
mkdir my-awesome-project
cd my-awesome-project

# Initialize with Git
git init

# Scaffold Guardian Framework
npx guardian-framework init
```

Follow the interactive prompts:
- **Project name:** `my-awesome-project`
- **Repository:** `my-org/my-awesome-project`
- **AI tools:** Select `pi` (recommended) + any others
- **Language:** Select your project language
- **Group ID:** `com.my-awesome-project`

This creates:
```
my-awesome-project/
├── .pi/                  # Source of truth (version-controlled)
│   ├── agent/AGENTS.md   # Project context + config
│   ├── context/          # Shared knowledge
│   ├── prompts/          # Workflow templates
│   ├── scripts/          # Validation scripts
│   ├── skills/           # Agent definitions
│   └── extensions/       # Pi extensions
├── .gitignore
├── WORKFLOW.md           # Entry point for agents + humans
└── guardian-manifest.json
```

## Step 2: Customize project context

Edit `.pi/agent/AGENTS.md` to fill in your project details:

- Set your project name, version, and repository URL
- Update the **Commands** section with your build/test/lint commands
- Set quality gate thresholds
- Remove sections that don't apply

## Step 3: Explore your domain (optional but recommended)

```bash
npx guardian-framework domain explore --context "We build a fintech payment platform..."
```

Or inside the pi agent:
```
/domain --explore "We build a fintech payment platform..."
```

## Step 4: Generate exports for your AI tools

```bash
npx guardian-framework generate
```

This creates `.claude/`, `.agents/`, `.github/`, etc. from the `.pi/` source.

## Step 5: Start building

Run the preflight checks:

```bash
bash .pi/scripts/ci/run_preflight.sh
```

Now your project is ready for AI-assisted development with full validation.

## Complete Example: TypeScript API Project

See the [templates/project/typescript](templates/project/typescript) directory for a complete scaffolded TypeScript API project structure.

## What's Next?

- Read the [README.md](../README.md) for full documentation
- Read the [WORKFLOW.md](../WORKFLOW.md) for agent workflow reference
- Explore `.pi/architecture/` for the canonical architecture documentation
