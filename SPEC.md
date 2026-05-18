# .wfp File Format Specification — Version 3

## Overview

A `.wfp` (Workflow People) file is a portable, self-contained JSON document that encodes a complete finance workflow — including process steps, data, custom logic, and domain knowledge — in a format that is human-readable, machine-executable, and shareable.

A `.wfp` file captures not just data (like `.xlsx`) or a final document (like `.pdf`), but the **process itself**: what to do, what data to use, what tools to apply, and what expertise to bring.

### Design Principles

1. **Portable** — a single file, no external dependencies
2. **Self-describing** — a human can read the JSON and understand the workflow
3. **Executable** — a runtime (or an LLM) can interpret and run it
4. **Composable** — workflows reference reusable tools, data, and knowledge by name
5. **Reproducible** — embedded knowledge packs mean the same file produces the same AI behaviour anywhere
6. **Domain-native** — built for finance and accounting mental models

### File Extension

`.wfp` — registered MIME type: `application/x-wfp+json`

---

## Top-Level Structure

```json
{
  "meta": { ... },
  "app_workflows": [ ... ],
  "app_custom_tools": [ ... ],
  "app_sessions": [ ... ],
  "app_knowledge_packs": [ ... ],
  "app_workspace_todos": [ ... ],
  "user_data": { ... },
  "dashboard_chat": { ... },
  "tool_data": { ... }
}
```

All top-level keys except `meta` are optional. A minimal valid `.wfp` file requires only `meta` and at least one entry in `app_workflows`.

---

## `meta`

File-level metadata.

| Field | Type | Required | Description |
|---|---|---|---|
| `format_version` | number | Recommended | Format version. Current: `3`. Readers should reject versions they don't support. |
| `spec_url` | string (URL) | Recommended | URL to the canonical format specification. LLMs receiving a pasted `.wfp` file can fetch this to understand the format. |
| `exported_at` | string (ISO 8601) | Recommended | When the file was exported. |
| `workspace` | string | Recommended | Human-readable workspace name. |
| `period` | string | Optional | Period label for the workspace (e.g., `"April 2026"`, `"FY2026 Q1"`). Used by dashboards. |
| `workspace_notes` | array | Optional | Free-text timestamped notes. Each entry: `{ "text": string, "createdAt": ISO8601 }`. |
| `workspace_persona` | string | Optional | Markdown persona description. Instructs the AI how to behave (e.g., "You are an experienced bookkeeper..."). |
| `modules` | string[] | Optional | Versioned module IDs enabled in this workspace (e.g., `["wfp_gl:1.0"]`). Importers auto-enable referenced modules. |

**Example:**

```json
{
  "meta": {
    "format_version": 3,
    "spec_url": "https://raw.githubusercontent.com/workflowpeople/wfp-format/main/SPEC.md",
    "exported_at": "2026-05-17T15:30:00.000Z",
    "workspace": "Small Biz Bookkeeping",
    "period": "April 2026",
    "workspace_notes": [
      { "text": "Waiting on Amex statement", "createdAt": "2026-05-16T10:00:00.000Z" }
    ],
    "workspace_persona": "You are an experienced bookkeeper...",
    "modules": ["wfp_gl:1.0"]
  }
}
```

---

## `app_workflows`

Array of workflow definitions. Each workflow is an ordered sequence of nodes (steps) connected by edges.

### Workflow Record

| Field | Type | Required | Description |
|---|---|---|---|
| `workflow_id` | string | Yes | Unique identifier (e.g., `"wf-view-reports"`). |
| `name` | string | Yes | Human-readable name (unique within file). |
| `description` | string | No | Markdown description: purpose, when to use, steps, outputs. |
| `type` | string | No | `"automation"` (runs step-by-step) or `"chat"` (conversational). Defaults to `"automation"`. |
| `nodes` | string | Yes | **JSON-stringified** array of `WorkflowNode` objects. |
| `edges` | string | Yes | **JSON-stringified** array of `Edge` objects. |
| `sort_order` | number | No | Display order on the workspace dashboard (0-based). |
| `depends_on` | string | No | JSON-stringified array of `workflow_id`s this workflow depends on. Used for status cascade (stale upstream → stale downstream). |
| `created_at` | string (ISO 8601) | No | Creation timestamp. |
| `updated_at` | string (ISO 8601) | No | Last modification timestamp. |
| `version` | number | No | Workflow version number. |
| `summary` | string | No | Short one-line summary of the workflow. |
| `snapshot_data` | any | No | Reserved for workflow state snapshots. |
| `builder_chat` | any | No | Reserved for workflow builder conversation history. |

> **Important:** `nodes`, `edges`, and `depends_on` are JSON **strings**, not raw arrays. This is because they are stored as TEXT in SQLite and preserved as-is during export. Parsers must call `JSON.parse()` on these fields.

### WorkflowNode

Each node represents one step in the workflow.

| Field | Type | Required | Description |
|---|---|---|---|
| `node_id` | string | Yes | Unique within the workflow (e.g., `"node-start"`, `"node-categorize"`). |
| `workflow_id` | string | Yes | Parent workflow ID. |
| `type` | string | Yes | Node type: `"start"`, `"end"`, `"tool"`, or `"prompt"`. |
| `label` | string | Yes | Human-readable step name (e.g., `"Categorize Transactions"`). |
| `tool_id` | string | No | Tool to execute. See [Tool ID Reference](#tool-id-reference). |
| `toolConfig` | object | No | Static tool configuration (e.g., `{ "provider": "anthropic", "model": "claude-sonnet-4-6" }`). |
| `toolParameters` | object | No | Runtime parameters. Values can reference other data using `{{name}}` syntax. |
| `workflowMgmt` | object | No | Workflow management metadata. See [Workflow Management](#workflow-management). |
| `step_order` | number | No | Execution order (1-based). If omitted, derived from edge traversal. |

### Edge

Defines execution flow between nodes.

| Field | Type | Required | Description |
|---|---|---|---|
| `edge_id` | string | Yes | Unique within the workflow. |
| `workflow_id` | string | Yes | Parent workflow ID. |
| `source_node_id` | string | Yes | Node this edge starts from. |
| `target_node_id` | string | Yes | Node this edge goes to. |

### Parameter References — `{{name}}` Syntax

Tool parameters can reference data by name using double-brace syntax:

```json
{
  "toolParameters": {
    "data": "{{checking}}",
    "instructions": "Categorize these transactions using {{chart-of-accounts}}..."
  }
}
```

At runtime, `{{name}}` resolves by looking up (in order):

1. **Session parameters** — values set by previous workflow steps via `api.setParameter()`
2. **User data** — files loaded in `user_data` section
3. **Knowledge packs** — content of a pack with matching `name` (if scope includes the current operation)

The legacy syntax `{{[name]}}` (with square brackets) is also supported for backward compatibility.

### Tool ID Reference

Tool IDs determine what executes at each node:

| Pattern | Type | Description |
|---|---|---|
| `utils_workflow_start` | Built-in | Workflow start marker |
| `utils_workflow_end` | Built-in | Workflow end marker |
| `llm_step` | Built-in | Sends a prompt to an LLM. Uses `toolParameters.prompt`, `toolParameters.data`, `toolParameters.instructions`, `toolParameters.context`. |
| `util_chat_download` | Built-in | Presents a download link to the user. Uses `toolParameters.data`, `toolParameters.filename`, `toolParameters.label`. |
| `gl_report_pl` | Built-in (GL module) | Generate Profit & Loss report. Parameters: `from_date`, `to_date`. |
| `gl_report_bs` | Built-in (GL module) | Generate Balance Sheet. Parameters: `as_of_date`. |
| `gl_report_cf` | Built-in (GL module) | Generate Cash Flow Statement. Parameters: `from_date`, `to_date`. |
| `ctool-*` | Custom | User-defined tool. Code and definition in `app_custom_tools`. |

### Workflow Management

Optional metadata on nodes for enterprise features:

| Field | Type | Description |
|---|---|---|
| `requiresApproval` | boolean | Pause workflow for approval before this step. |
| `approverEmail` | string | Who should approve. |
| `approverRole` | string | Role-based approval. |
| `approvalMessage` | string | Message shown to approver. |
| `sendEmail` | boolean or string | Send email notification at this step. |
| `emailTo` | string | Recipient email. |
| `emailSubject` | string | Email subject. |
| `emailBody` | string | Email body. |
| `chatMsgBody` | string | Status message shown in chat when this step completes. |
| `slaHours` | number | Expected completion time. |
| `budgetedHours` | number | Budgeted time for this step. |

---

## `app_custom_tools`

Array of user-defined tools containing executable code.

| Field | Type | Required | Description |
|---|---|---|---|
| `tool_id` | string | Yes | Unique identifier, conventionally prefixed `ctool-` (e.g., `"ctool-ar-aging"`). |
| `name` | string | Yes | Human-readable tool name. |
| `description` | string | Yes | Short description (plain text). |
| `description_md` | string | No | Extended description (markdown). |
| `category` | string | No | Category for organization (e.g., `"bookkeeping"`, `"reporting"`). |
| `code` | string | Yes | JavaScript function body. See [Custom Tool Code](#custom-tool-code). |
| `definition_json` | string | Yes | JSON-stringified tool definition. See [Tool Definition](#tool-definition). |
| `chat_history` | string | No | Builder conversation history (used during tool development). |
| `created_at` | string (ISO 8601) | No | Creation timestamp. |
| `updated_at` | string (ISO 8601) | No | Last modification timestamp. |

### Custom Tool Code

The `code` field contains a JavaScript **function body only** — no function wrapper, no exports.

The code receives a single argument: `api`, which provides controlled access to workflow data and operations.

```javascript
// CORRECT — function body only
const data = api.getParameter('input_data');
const result = processData(data);
api.setParameter('output', result);
return { status: 'success', statusMessage: 'Processed ' + result.length + ' items' };
```

```javascript
// INCORRECT — do NOT include function wrapper
async function myTool(api) { ... }  // Wrong
export default function(api) { ... }  // Wrong
```

### Tool API (`api` object)

Methods available to custom tool code at runtime:

| Method | Description |
|---|---|
| `api.getParameter(name)` | Read a named parameter (from session, user data, or knowledge pack). |
| `api.setParameter(name, value)` | Set a session-scoped parameter for downstream steps. |
| `api.setUserData(name, value)` | Persist data to the workspace (survives across sessions). |
| `api.addMessage(msg)` | Add a message to the chat UI. `msg` can have `html`, `markdown`, or `role` fields. |
| `api.pauseForInput(msg)` | Pause workflow execution and prompt the user for input. |
| `api.getNodeContext()` | Get metadata about the current workflow node. |
| `api.getKnowledge(name)` | Read the content of a knowledge pack by name. |
| `api.llm.classify(options)` | Call an LLM to classify/categorize data. |
| `api.llm.summarize(options)` | Call an LLM to summarize text. |
| `api.fetch(url, options)` | Make an HTTP request (for external API integrations). |
| `api.getSecret(name)` | Read an encrypted secret from workspace settings. |
| `api.query(sql, params)` | Read-only SQL query against workspace tables. |
| `api.wfpGl.load(files)` | (GL module) Load user data files into `wfp_gl`. |
| `api.wfpGl.loadBudget(files)` | (GL module) Load budget data into `wfp_budget`. |
| `api.wfpGl.clear()` | (GL module) Clear all GL tables. |

### Tool Definition

The `definition_json` field describes the tool's inputs and outputs:

```json
{
  "parameters": [
    {
      "name": "invoices_data",
      "type": "string",
      "description": "Invoice CSV: invoice_id, client, amount, issue_date, due_date, status",
      "required": true
    }
  ],
  "outputs": [
    {
      "name": "aging_data",
      "type": "string",
      "description": "JSON aging analysis with buckets and overdue list"
    }
  ]
}
```

---

## `app_sessions`

Array of saved workflow execution sessions. Each session captures the state of a workflow run including messages, progress, and intermediate results.

Sessions are typically empty in shared `.wfp` files (you share the workflow, not your run history). Included here for completeness.

| Field | Type | Description |
|---|---|---|
| `id` | string | Session UUID. |
| `workflow_id` | string | Which workflow was run. |
| `session_name` | string | Human-readable session name. |
| `instance_status` | string | `"pending"`, `"in_progress"`, `"completed"`, `"awaiting_feedback"`, `"blocked"`, `"cancelled"`, `"scheduled"`. |
| `messages` | string | JSON-stringified array of chat messages. |
| `workflow` | string | JSON-stringified array of workflow node state. |
| `edges` | string | JSON-stringified array of edges. |
| `tasks` | string | JSON-stringified array of task objects. |
| `waiting_for_input` | number | `0` or `1` — whether the workflow is paused for user input. |
| `waiting_for_approval` | number | `0` or `1` — whether the workflow is paused for approval. |
| `metadata` | string | JSON-stringified key-value metadata. |
| `created_at` | string (ISO 8601) | Session start time. |
| `updated_at` | string (ISO 8601) | Last activity. |
| `completed_at` | string (ISO 8601) | Completion time (if completed). |

---

## `app_knowledge_packs`

Array of knowledge packs — markdown documents that teach the AI about the business: chart of accounts, tax rules, vendor lists, close procedures, API schemas, anything the workflow author wants the AI to know.

Every knowledge pack is **embedded in the .wfp file**. This makes the file fully self-contained and portable: give it to a colleague, open it on another server, and it works. No external references to resolve.

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Unique name (e.g., `"tax-rules"`, `"chart-of-accounts"`). |
| `scope` | string | Yes | When the pack is loaded: `"chat"`, `"workflow"`, or `"chat+workflow"`. A special scope `"privacy-map"` is reserved for entity-masking packs (see [Privacy Map](#privacy-map)). |
| `tags` | string[] | No | Tags for organization (e.g., `["tax", "classification"]`). Default: `[]`. |
| `content` | string | Yes | Markdown content — business rules, procedures, account structures, API schemas, etc. |
| `created_at` | string (ISO 8601) | No | Creation timestamp. |
| `updated_at` | string (ISO 8601) | No | Last modification timestamp. |

**Example:**

```json
{
  "name": "tax-rules",
  "scope": "chat+workflow",
  "tags": ["tax", "classification", "expenses"],
  "content": "# Tax Classification Rules\n\n## Travel & Meals\n- Meals during business travel: Account 6240 (Travel Meals), max $75/day\n- Client entertainment: Account 6250 (Entertainment), requires receipt over $25\n...",
  "created_at": "2026-04-15T10:00:00.000Z",
  "updated_at": "2026-04-20T14:30:00.000Z"
}
```

### Scopes

| Scope | Loaded for |
|---|---|
| `chat` | Chat / AI operations only (build, modify, ask, plan) |
| `workflow` | Workflow runtime only (available to custom tools via `api.getKnowledge()`) |
| `chat+workflow` | Both (default for most user packs) |
| `privacy-map` | Special — entity-masking layer, never sent to the LLM |

### Privacy Map

A knowledge pack with `scope: "privacy-map"` contains a list of entity names (one per line) that should be masked before any prompt is sent to a cloud LLM. The runtime substitutes each name with an opaque token (`«E1»`, `«E2»`, …) and unmasks the response on return. The LLM sees only tokens, allowing structural processing (categorize, calculate, report) without seeing real client/entity names.

### Legacy

Older `.wfp` files (format_version 2 and earlier) may contain an `app_knowledge` section with `skill_id` / `name` / `content` fields. Readers should import these into `app_knowledge_packs` with `scope: "chat+workflow"` and no tags.

### Design rationale

Knowledge packs are embedded rather than stored centrally because:

1. **Portability** — the .wfp file works anywhere, no server dependency
2. **Reproducibility** — re-running a workflow always uses the same knowledge
3. **Auditability** — what's in the file IS what ran, no ambiguity
4. **Privacy** — business rules stay in the user's file, not on a shared server

Future tiers (firm-wide packs, hosting-level packs) will merge into the workspace at load time, but the .wfp export will always contain a snapshot of the active packs.

---

## `app_workspace_todos`

Array of workspace-scoped todos. Used to decompose complex projects into discrete tasks the user can work through. Each todo can be clicked to open a new session pre-filled with the instruction.

| Field | Type | Required | Description |
|---|---|---|---|
| `todo_id` | string | No | Stable identifier (auto-generated on import if absent). |
| `label` | string | Yes | Short human-readable label shown in the todo list. |
| `instruction` | string | No | Pre-filled session instruction (e.g., `"/wf-build expense review workflow"`). |
| `status` | string | Yes | `"pending"`, `"in_progress"`, `"done"`, or `"cancelled"`. |
| `sort_order` | number | No | Display order (0-based). |
| `source` | string | No | Origin: `"planner"`, `"user"`, `"audit"`, `"system"`, or `"session:<id>"`. |
| `category` | string | No | One of `"build"`, `"data"`, `"knowledge"`, `"review"`, `"general"`. |
| `created_at` | string (ISO 8601) | No | Creation timestamp. |
| `updated_at` | string (ISO 8601) | No | Last update timestamp. |

**Example:**

```json
{
  "app_workspace_todos": [
    {
      "label": "Build expense review workflow",
      "instruction": "/wf-build categorize and review monthly expenses by account",
      "status": "pending",
      "sort_order": 0,
      "source": "planner",
      "category": "build"
    }
  ]
}
```

---

## `user_data`

Key-value map of named data files. These are the datasets the workflow operates on — bank transactions, invoices, budgets, etc.

```json
{
  "user_data": {
    "checking": {
      "content": "date,description,amount\n2025-03-01,Deposit,8500.00\n...",
      "content_type": "csv",
      "content_json": null,
      "columns": "[\"date\", \"description\", \"amount\"]",
      "row_count": 14
    },
    "invoices": {
      "content": "invoice_id,client,amount,...",
      "content_type": "csv",
      "content_json": null,
      "columns": "[\"invoice_id\", \"client\", \"amount\", \"issue_date\", \"due_date\", \"status\"]",
      "row_count": 9
    }
  }
}
```

### User Data Entry

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | Yes | Raw content — CSV text, JSON string, or plain text. |
| `content_type` | string | No | Type hint: `"csv"`, `"json_array"`, `"json_object"`, or `"text"`. Default: `"text"`. |
| `content_json` | string | No | JSON-stringified structured representation (for `json_array` and `json_object` types). |
| `columns` | string | No | JSON-stringified array of column names (for tabular data). |
| `row_count` | number | No | Number of data rows (for tabular data). |

**Legacy format:** Older `.wfp` files may store user data as plain strings instead of objects:

```json
{
  "user_data": {
    "checking": "date,description,amount\n2025-03-01,Deposit,8500.00\n..."
  }
}
```

Readers should handle both formats.

---

## `dashboard_chat`

Saved conversation history from the main dashboard chat interface.

| Field | Type | Description |
|---|---|---|
| `messages` | array | Array of message objects (see below). |
| `last_focus_panel` | object or null | UI state — which panel was last focused. |

### Message Object

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique message ID (typically timestamp-based). |
| `role` | string | `"user"`, `"assistant"`, `"tool"`, `"system"`, `"error"`, or `"form"`. |
| `source` | string | Origin (tool name, `"user"`, etc.). |
| `html` | string | Rendered HTML content. |
| `markdown` | string | Markdown source (if applicable). |
| `timestamp` | string (ISO 8601) | When the message was created. |
| `nodeId` | string | Workflow node that generated this message (if applicable). |
| `nodeLabel` | string | Human-readable node label. |
| `json` | any | Structured data payload (if applicable). |

---

## `tool_data`

Extensible key-value map for tool-specific persistent data. Each key corresponds to a registered tool data handler.

### General Ledger (`wfp_gl`) — v3 unified GL

The GL module is **optional** (enabled per-workspace via `meta.modules`). When present, it stores three tables — all journal lines, budget, and chart of accounts — under a single `tool_data.wfp_gl` block:

```json
{
  "tool_data": {
    "wfp_gl": {
      "label": "GL Journal Data",
      "manifest": {
        "tables": {
          "wfp_gl": {
            "columns": ["date", "transaction_type", "num", "name", "memo", "account", "account_type", "class", "location", "entity", "vendor", "customer", "debit", "credit", "amount", "period", "source_file"],
            "types": ["TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "REAL", "REAL", "REAL", "TEXT", "TEXT"],
            "row_count": 412,
            "format": "csv"
          },
          "wfp_budget": {
            "columns": ["account", "period", "amount", "class", "location", "entity", "source_file"],
            "types": ["TEXT", "TEXT", "REAL", "TEXT", "TEXT", "TEXT", "TEXT"],
            "row_count": 24,
            "format": "csv"
          },
          "wfp_accounts": {
            "columns": ["account", "account_type", "description", "active", "entity", "account_number", "account_name", "parent_account", "parent_number", "parent_name", "account_level"],
            "types": ["TEXT", "TEXT", "TEXT", "INTEGER", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "INTEGER"],
            "row_count": 64,
            "format": "csv"
          }
        }
      },
      "data": {
        "wfp_gl": "date,transaction_type,num,name,memo,account,...",
        "wfp_budget": "account,period,amount,...",
        "wfp_accounts": "account,account_type,description,..."
      }
    }
  }
}
```

#### Key v3 GL design points

- **Unified journal:** Imported QBO entries, opening balances, and manual journal entries all live in `wfp_gl`. They are distinguished by `transaction_type` (e.g., `"Opening Balance"`, `"Journal Entry"`, or the QBO transaction type).
- **Opening balances** are dated to the as-of day (typically prior year-end) and ride as ordinary `wfp_gl` rows. The Balance Sheet computes `SUM(amount) WHERE date ≤ as_of`. If an opening file's debits ≠ credits, the difference is plugged to **Opening Balance Equity**.
- **Vendor / Customer** are columns on `wfp_gl`, not separate master tables. Available as pivot dimensions.
- **Account hierarchy** is derived from the colon-delimited full name (e.g., `7000-00 Compensation:7031-00 Insurance` → parent=`7000-00 Compensation`, level=2). `wfp_gl.account` stays as the flat full name; hierarchy is a lookup.
- **Periods** use `YYYY-MM` format.
- **Currency** is USD-only at this version.

#### Legacy GL (`gl`) — v2

Older `.wfp` files (format_version 2) may contain a legacy `tool_data.gl` block with separate `gl_accounts`, `gl_entries`, and `gl_postings` tables. Readers should treat this as deprecated; importers should migrate `gl_entries` + `gl_postings` rows into the unified `wfp_gl` table, dropping `gl_accounts` rows into `wfp_accounts`.

### Tool Data Block Structure

| Field | Type | Description |
|---|---|---|
| `label` | string | Human-readable name for this data set. |
| `manifest.tables` | object | Map of table names to table manifests. |
| `manifest.tables[name].columns` | string[] | Column names. |
| `manifest.tables[name].types` | string[] | SQLite column types. |
| `manifest.tables[name].row_count` | number | Number of data rows. |
| `manifest.tables[name].format` | string | Data format (currently always `"csv"`). |
| `data` | object | Map of table names to CSV string data. |

Other modules can register their own data handlers using the same block structure.

---

## Encryption

`.wfp` files can optionally be encrypted with a passphrase. Encrypted files are wrapped in an envelope that is detected before parsing. The inner content, once decrypted, is a standard `.wfp` JSON document.

Encryption details are implementation-specific and outside the scope of this format specification.

---

## Minimal Valid .wfp File

The smallest useful `.wfp` file — a single workflow with one LLM step that references a knowledge pack:

```json
{
  "meta": {
    "format_version": 3,
    "workspace": "Quick Analysis"
  },
  "app_workflows": [
    {
      "workflow_id": "wf-analyze",
      "name": "Analyze Data",
      "type": "automation",
      "sort_order": 0,
      "nodes": "[{\"node_id\":\"node-start\",\"workflow_id\":\"wf-analyze\",\"type\":\"tool\",\"label\":\"Start\",\"tool_id\":\"utils_workflow_start\",\"step_order\":1},{\"node_id\":\"node-analyze\",\"workflow_id\":\"wf-analyze\",\"type\":\"tool\",\"label\":\"Analyze\",\"tool_id\":\"llm_step\",\"toolParameters\":{\"data\":\"{{input_data}}\",\"instructions\":\"Analyze this financial data. Identify trends, anomalies, and key takeaways. Present findings in a clear table.\"},\"step_order\":2},{\"node_id\":\"node-end\",\"workflow_id\":\"wf-analyze\",\"type\":\"end\",\"label\":\"Done\",\"tool_id\":\"utils_workflow_end\",\"step_order\":3}]",
      "edges": "[{\"edge_id\":\"e1\",\"workflow_id\":\"wf-analyze\",\"source_node_id\":\"node-start\",\"target_node_id\":\"node-analyze\"},{\"edge_id\":\"e2\",\"workflow_id\":\"wf-analyze\",\"source_node_id\":\"node-analyze\",\"target_node_id\":\"node-end\"}]"
    }
  ],
  "app_custom_tools": [],
  "app_knowledge_packs": [
    {
      "name": "analysis-guide",
      "scope": "chat+workflow",
      "content": "# Analysis Guide\n\nFocus on month-over-month variance and flag anything > 10% change."
    }
  ],
  "user_data": {
    "input_data": {
      "content": "month,revenue,expenses\nJan,50000,42000\nFeb,55000,43000\nMar,48000,44000",
      "content_type": "csv",
      "columns": "[\"month\", \"revenue\", \"expenses\"]",
      "row_count": 3
    }
  }
}
```

---

## Version History

| Version | Changes |
|---|---|
| **3** (current) | Renamed `app_knowledge` → `app_knowledge_packs` (added `scope`, `tags`). Added top-level `app_workspace_todos`. Added `meta.period`, `meta.workspace_notes`, `meta.modules`. Added `app_workflows.sort_order`, `app_workflows.depends_on`. Replaced legacy `tool_data.gl` with unified `tool_data.wfp_gl` (single journal table covering imported, opening, and manual entries; vendor/customer columns; account hierarchy). |
| **2** | JSON format. Added `user_data` metadata fields (`content_type`, `content_json`, `columns`, `row_count`). Added `tool_data` for extensible tool storage. Added `dashboard_chat`. Added `workspace_persona` to meta. |
| **1** | Section-based text format using `[START:section]...[END:section]` markers with CSV data. Still importable by the reference implementation. |

### Reading older versions

Reference implementations are expected to read versions 1 and 2 alongside 3. Specifically:

- `app_knowledge` (v2) → import into `app_knowledge_packs` with `scope: "chat+workflow"` and `tags: []`
- `tool_data.gl` (v2) → migrate rows into `tool_data.wfp_gl`
- v1 section-based text → parse to v3 JSON structure

---

## License

This specification is released under the MIT License. You are free to implement readers, writers, and runners for the `.wfp` format in any language, for any purpose.
