# Vestel Crucible MCP Server

An integration server built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) that connects AI assistants to Atlassian Crucible/Fisheye. It provides tools to retrieve recent project reviews, project commits, review details, and unified file diffs.

## Features

- **Get Recent Reviews**: Fetch the most recent code reviews (RSS-based for high performance) from a specific Crucible project.
- **Get Recent Commits**: Fetch the most recent commits/changesets from a specific repository linked to Crucible.
- **Fetch Review Details**: Retrieve detailed information about a specific code review, including changed files (review items), authors, and comments.
- **Get File Diff (Patch)**: Dynamically fetch and compute the unified diff (patch) between two file versions inside a code review using `fromContentUrl` and `toContentUrl`.
- **Strict Schema Compliance**: All tools declare input and output schemas conforming to the MCP specifications.

---

## Installation

1. Clone or copy the repository files.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```

---

## Configuration

The server is configured via environment variables or a configuration file.

| Variable | Description | Example |
| :--- | :--- | :--- |
| `CRUCIBLE_URL` | Base URL of your Crucible instance | `https://rdreview.vestel.com.tr` |
| `CRUCIBLE_USERNAME` | Username (required for `basic` authentication) | `your_username` |
| `CRUCIBLE_PASSWORD` | Password for basic authentication | `your_password` |
| `CRUCIBLE_API_TOKEN` | API Token (if supported/configured instead of Basic auth) | `your_token` |

### Configuration File (`.crucible-config.json`)

You can easily provide configuration by creating a `.crucible-config.json` file in your home directory (`~/.crucible-config.json`) or directly inside the project directory:

```json
{
  "baseUrl": "https://rdreview.vestel.com.tr",
  "username": "your_username",
  "password": "your_password"
}
```

---

## Available MCP Tools

### `crucible_get_recent_reviews`
Lists recent code reviews from a project (e.g. AndroidTV).
- **Inputs:** `project` (string), `limit` (number, default: 30)

### `crucible_get_recent_commits`
Lists recent commits/changesets from a project repository (e.g. AndroidTV).
- **Inputs:** `project` (string), `limit` (number, default: 30)

### `crucible_get_review_details`
Get detailed information about a specific review, including files and patches/diffs.
- **Inputs:** `reviewId` (string, e.g., 'CR-123')

### `crucible_get_file_diff`
Get the unified diff (patch) for a specific file change using its fromContentUrl and toContentUrl.
- **Inputs:** `fromContentUrl` (string), `toContentUrl` (string)

---

## Development & Contribution
- Check `.agents/AGENTS.md` for AI agent guidelines and onboarding.
- Adhere to the `vitest` unit testing standards found in the `tests/` directory.
- Code should be documented using JSDoc.
