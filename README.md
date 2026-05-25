# .wfp File Format — Simplified Spec (1.0.0)

A `.wfp` file is one JSON document that captures a complete workflow workspace:
the workflows themselves, the tools they use, the data they operate on, the
knowledge that informs them, the sessions that have run, and any optional
extensions a particular runner adds.

The format is designed to be readable by a person opening the file in a text
editor and clear to an AI receiving it pasted into a prompt. There are seven
top-level keys. Nothing else.

```json
{
  "metadata":   { ... },
  "workflows":  [ ... ],
  "tools":      [ ... ],
  "data":       { ... },
  "knowledge":  [ ... ],
  "sessions":   [ ... ],
  "extensions": { ... }
}
```

`metadata` and `workflows` are required (with at least one workflow). Everything
else is optional. A runner MUST preserve every top-level key it does not actively
manage (and every unknown key inside `extensions`) when it saves the file —
that is the only compatibility rule. See [The round-trip rule](#the-round-trip-rule).

---

## 1. `metadata`

File-level information.

```json
{
  "metadata": {
    "format_version": "1.0.0",
    "workspace": "Acme Corp Books",
    "spec_url": "https://github.com/workflowpeople/wfp-format/blob/main/README.md",
    "exported_at": "2026-05-22T15:30:00.000Z",
    "period": "April 2026",
    "persona": "You are an experienced bookkeeper...",
    "notes": [
      {
        "text": "Waiting on Amex statement",
        "created_at": "2026-05-21T10:00:00.000Z"
      }
    ]
  }
}
```

| Field            | Type              | Required    | Description                                                               |
| ---------------- | ----------------- | ----------- | ------------------------------------------------------------------------- |
| `format_version` | string (semver)   | Yes         | Spec version this file conforms to. Current: `"1.0.0"`.                   |
| `workspace`      | string            | Yes         | Human-readable workspace name.                                            |
| `spec_url`       | string (URL)      | Recommended | Where the format is documented. An LLM receiving the file can fetch this. |
| `exported_at`    | string (ISO 8601) | Recommended | When the file was written.                                                |
| `period`         | string            | Optional    | Period label (e.g., `"April 2026"`, `"FY2026 Q1"`).                       |
| `persona`        | string            | Optional    | Markdown instructions for the AI's voice/role across this workspace.      |
| `notes`          | array             | Optional    | Free-text workspace notes. Each `{ text, created_at }`.                   |

---

## 2. `workflows`

A workflow is an ordered list of steps (nodes). Steps execute in `step_order`.
There is no separate `edges` field — for branching workflows, that lives in an
extension (see §7).

```json
{
  "workflows": [
    {
      "id": "wf-categorize",
      "name": "Categorize Transactions",
      "description": "Read checking activity, classify each row using the chart of accounts, produce a CSV.",
      "type": "automation",
      "nodes": [
        {
          "id": "n-start",
          "type": "start",
          "label": "Start",
          "step_order": 1,
          "tool_id": "workflow_start"
        },
        {
          "id": "n-categorize",
          "type": "tool",
          "label": "Categorize",
          "step_order": 2,
          "tool_id": "llm_step",
          "tool_parameters": {
            "data": "{{checking}}",
            "instructions": "Categorize each transaction using {{chart-of-accounts}}. Return CSV."
          }
        },
        {
          "id": "n-end",
          "type": "end",
          "label": "Done",
          "step_order": 3,
          "tool_id": "workflow_end"
        }
      ]
    }
  ]
}
```

### Workflow

| Field         | Type              | Required | Description                                    |
| ------------- | ----------------- | -------- | ---------------------------------------------- |
| `id`          | string            | Yes      | Unique within the file.                        |
| `name`        | string            | Yes      | Human-readable; unique within the file.        |
| `description` | string            | No       | Markdown description.                          |
| `type`        | string            | No       | `"automation"` (default) or `"chat"`.          |
| `nodes`       | Node[]            | Yes      | Ordered list of steps.                         |
| `summary`     | string            | No       | One-line summary for dashboards.               |
| `sort_order`  | number            | No       | Display order in the workspace UI (0-based).   |
| `depends_on`  | string[]          | No       | Other workflow `id`s this workflow depends on. |
| `created_at`  | string (ISO 8601) | No       |                                                |
| `updated_at`  | string (ISO 8601) | No       |                                                |

### Node

| Field             | Type   | Required | Description                                                                               |
| ----------------- | ------ | -------- | ----------------------------------------------------------------------------------------- |
| `id`              | string | Yes      | Unique within the workflow.                                                               |
| `type`            | string | Yes      | `"start"`, `"end"`, `"tool"`, or `"prompt"`. UI hint — does not affect dispatch.           |
| `label`           | string | Yes      | Human-readable step name.                                                                 |
| `step_order`      | number | Yes      | Execution order (1-based).                                                                |
| `tool_id`         | string | Yes      | Tool to execute. For start/end markers use `workflow_start` / `workflow_end`. See [§3 Reserved tool IDs](#reserved-tool-ids). |
| `tool_config`     | object | No       | Static configuration (e.g., `{ "provider": "anthropic", "model": "claude-sonnet-4-6" }`). |
| `tool_parameters` | object | No       | Runtime parameters. Values may reference data via `{{name}}`.                             |
| `workflow_mgmt`   | object | No       | Approval, email, SLA, budget metadata. See below.                                         |

Tool dispatch is always driven by `tool_id`. The `type` field is a UI hint only;
runners MUST NOT use it to decide what to execute.

### Parameter references — `{{name}}`

In `tool_parameters`, the substring `{{name}}` is resolved at runtime in this order:

1. **Session parameters** — values set by previous steps via `api.setParameter()`.
2. **Data** — entries in `data` (§4) with matching name.
3. **Knowledge** — entries in `knowledge` (§5) with matching `name` whose scope applies.

### Workflow management (optional)

A node may include a `workflow_mgmt` block with any of:

| Field               | Type    | Description                                            |
| ------------------- | ------- | ------------------------------------------------------ |
| `requires_approval` | boolean | Pause for approval before this step.                   |
| `approver_email`    | string  | Who should approve.                                    |
| `approver_role`     | string  | Role-based approval.                                   |
| `approval_message`  | string  | Message shown to approver.                             |
| `send_email`        | boolean | Send email notification at this step.                  |
| `email_to`          | string  | Recipient.                                             |
| `email_subject`     | string  | Subject.                                               |
| `email_body`        | string  | Body.                                                  |
| `chat_msg`          | string  | Status message shown in chat when this step completes. |
| `sla_hours`         | number  | Expected completion time.                              |
| `budgeted_hours`    | number  | Budgeted time for this step.                           |

---

## 3. `tools`

Reusable units of executable logic. Three kinds of tools exist:

- **Built-in tools** — exactly four IDs reserved by this spec:
  `workflow_start`, `workflow_end`, `llm_step`, `chat_download`. Provided
  by the runtime. They do not appear in the file; nodes simply reference
  them by `tool_id`. See [Reserved tool IDs](#reserved-tool-ids).
- **Custom tools** — user-defined JavaScript. They DO appear in the file.
  Their `tool_id` MUST use the `ctool-*` prefix.
- **Service tools** — wrappers around external HTTP services. They appear in
  the file as custom tools whose `code` calls `api.fetch()` (typically with
  an api-key read from `api.ext.secrets`). The spec treats them as ordinary
  custom tools.

```json
{
  "tools": [
    {
      "tool_id": "ctool-ar-aging",
      "name": "AR Aging",
      "description": "Bucket open invoices by days past due and produce a summary.",
      "category": "reporting",
      "api_version": "1.0.0",
      "inputs": [
        {
          "name": "invoices",
          "type": "string",
          "required": true,
          "description": "Invoice CSV: invoice_id, client, amount, issue_date, due_date, status"
        }
      ],
      "outputs": [
        {
          "name": "aging",
          "type": "object",
          "description": "JSON with bucket totals and overdue list"
        }
      ],
      "code": "const csv = api.getParameter('invoices');\n// ... function body ...\napi.setParameter('aging', result);\nreturn { status: 'success' };"
    }
  ]
}
```

### Tool

| Field               | Type              | Required | Description                                                                                                    |
| ------------------- | ----------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `tool_id`           | string            | Yes      | Unique identifier. Conventionally `ctool-*` for custom tools.                                                  |
| `name`              | string            | Yes      | Human-readable tool name.                                                                                      |
| `description`       | string            | Yes      | Short plain-text description.                                                                                  |
| `description_md`    | string            | No       | Longer markdown description.                                                                                   |
| `category`          | string            | No       | Grouping (e.g., `"bookkeeping"`, `"reporting"`).                                                               |
| `color`             | string            | No       | Optional hex override for the category dot in UIs.                                                             |
| `api_version`       | string (semver)   | Yes      | Tool API version the code expects. Runners refuse to load tools whose major version doesn't match the runtime. |
| `inputs`            | Input[]           | Yes      | Declared input parameters.                                                                                     |
| `outputs`           | Output[]          | Yes      | Declared outputs.                                                                                              |
| `code`              | string            | Yes      | JavaScript function body. Receives a single `api` argument. No `function` wrapper, no exports.                 |
| `allow_custom_code` | boolean           | No       | Whether end-users may edit the code. Default: `true`.                                                          |
| `chat_runnable`     | boolean           | No       | Tool may be invoked directly from chat (not only inside a workflow).                                           |
| `created_at`        | string (ISO 8601) | No       |                                                                                                                |
| `updated_at`        | string (ISO 8601) | No       |                                                                                                                |

### Input

| Field         | Type     | Required | Description                                                                      |
| ------------- | -------- | -------- | -------------------------------------------------------------------------------- |
| `name`        | string   | Yes      |                                                                                  |
| `type`        | string   | Yes      | One of `"string"`, `"number"`, `"boolean"`, `"object"`, `"array"`, `"filepath"`. |
| `required`    | boolean  | No       | Default: `false`.                                                                |
| `description` | string   | No       |                                                                                  |
| `default`     | any      | No       |                                                                                  |
| `enum`        | string[] | No       | Restricted set of values (dropdown).                                             |

### Output

| Field         | Type   | Required | Description                                                        |
| ------------- | ------ | -------- | ------------------------------------------------------------------ |
| `name`        | string | Yes      |                                                                    |
| `type`        | string | Yes      | One of `"string"`, `"number"`, `"boolean"`, `"object"`, `"array"`. |
| `description` | string | No       |                                                                    |
| `example`     | any    | No       |                                                                    |

### Reserved tool IDs

The following `tool_id` values are reserved by this spec. They name the
runtime's built-in tools. A `.wfp` file MUST NOT declare a custom tool whose
`tool_id` equals a reserved value, and a runner MUST refuse to load a file
that does.

| Tool ID           | What it does                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `workflow_start`  | Required first node of every workflow. Marks the entry point. `tool_parameters`: `{}`.                                        |
| `workflow_end`    | Required last node of every workflow. Marks completion. `tool_parameters`: `{}`.                                              |
| `llm_step`        | Calls the configured LLM with a prompt. `tool_parameters`: `{ prompt, data?, instructions?, context? }`. Sets the parameter `llm_response`. |
| `chat_download`   | Presents a download to the user. `tool_parameters`: `{ data, filename, label?, inline? }`. Inline `"true"` renders HTML in-place. |

Custom tools authored by users MUST use the `ctool-*` prefix. A runner
resolves a node's `tool_id` in this order:

1. The built-in registry above.
2. The custom tools table (`tools[]`, where each entry's `tool_id` starts with `ctool-`).
3. If neither matches, the runner MUST emit a clear `unknown tool_id` message and continue (skip the node) rather than crashing.

Vendor- or app-specific built-ins are NOT permitted in `tool_id`. Apps that
need to expose extra capabilities at runtime do so through the
`api.ext.*` extension namespace described below — not by minting new
`tool_id` values.

### The `api` object available to custom tool code

The runtime API is divided into a guaranteed core surface and an open
extension namespace. Every conformant runner MUST provide every Tier 1 and
Tier 2 method. Extensions are app-specific and OPTIONAL.

#### Tier 1 — Core (every runner provides)

| Method                            | Purpose                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `api.getParameter(name)`          | Read a parameter (unwrapped from its typed envelope).                                  |
| `api.getParameterMeta(name)`      | Read envelope metadata: `{ type, columns?, rowCount?, length? }`.                      |
| `api.setParameter(name, value)`   | Set a session-scoped value for downstream steps.                                       |
| `api.setData(name, value)`        | Persist into the workspace's `data` map (round-trips back into the `.wfp` on save).    |
| `api.addMessage(msg)`             | Append a message to the running session. Body shapes: `markdown`, `html`, `voice`, `table`, `chart`, `form`, `json`, `data`. Runners that don't render a given shape MUST degrade gracefully (e.g. render `voice` text as a log line). |
| `api.fetch(url, opts)`            | HTTP request to an external service. Runners MUST block requests to private networks, enforce a 60-second timeout, and cap response bodies at 5 MB. Returns `{ status, headers, data, text }`. |

#### Tier 2 — Required, universal

| Method                                  | Purpose                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `api.getKnowledge(name)`                | Return a knowledge pack's markdown content, or `null`.                           |
| `api.llm.complete({ messages, ... })`   | Call the LLM with a raw message list. Returns `{ text, model, usage }`.          |
| `api.getChatHistory(limit?)`            | Recent chat turns from the active session. Returns `[]` if no chat session.      |
| `api.appendChat({ role, content })`     | Append a turn to the active session's chat. Lazily creates the session if absent.|
| `api.pauseForInput(msg)`                | Pause the workflow, show a form/prompt, resume when the user submits. Pause state lives in the session. |

#### Extensions — `api.ext.*`

Apps may register additional capabilities under the `api.ext` namespace.
The core spec does NOT standardize what lives there — extensions are
app-specific. Tool code that depends on an extension MUST check for its
presence:

```js
const key = await api.ext?.secrets?.get?.("supabase");
if (!key) {
  api.addMessage({ markdown: "This workflow needs a **supabase** secret." });
  return;
}
```

A runner that does not register a given extension MUST leave the namespace
key absent (not throw). This lets one `.wfp` file open in any runner and
degrade gracefully where an extension is unavailable.

**Common extensions observed in production**

| Namespace          | Typical provider         | Methods                                                                       |
| ------------------ | ------------------------ | ----------------------------------------------------------------------------- |
| `api.ext.secrets`  | hosted app               | `get(name): Promise<string \| null>` — read a named secret from the user's vault. |
| `api.ext.privacyMap` | hosted app             | Entity-masking layer (tokenize/untokenize around LLM calls).                  |

External services (GL, payroll, vendor APIs, etc.) are reached via
`api.fetch()` — typically with an api-key obtained from
`api.ext.secrets.get()` — plus a knowledge pack that documents the service's
endpoints. There is no first-class GL section in the file format.

---

## 4. `data`

Named data files the workflows operate on — CSVs, JSON arrays, JSON objects,
or plain text. Stored as a map keyed by data name.

```json
{
  "data": {
    "checking": {
      "content": "date,description,amount\n2025-03-01,Deposit,8500.00\n...",
      "content_type": "csv",
      "columns": ["date", "description", "amount"],
      "row_count": 14,
      "source_filename": "checking_apr_2026.csv",
      "loaded_at": "2026-05-01T09:15:00.000Z",
      "edited_at": null
    },
    "current_quarter": {
      "content": "{\"q\":\"Q2\",\"year\":2026}",
      "content_type": "json_object"
    }
  }
}
```

| Field             | Type                      | Required | Description                                                                     |
| ----------------- | ------------------------- | -------- | ------------------------------------------------------------------------------- |
| `content`         | string                    | Yes      | Raw content. May be replaced by an [encryption envelope](#encryption-envelope). |
| `content_type`    | string                    | No       | `"csv"`, `"json_array"`, `"json_object"`, or `"text"`. Default: `"text"`.       |
| `content_json`    | any                       | No       | Pre-parsed structured form (for `json_array`, `json_object`).                   |
| `columns`         | string[]                  | No       | Column names (for tabular).                                                     |
| `row_count`       | number                    | No       | Row count (for tabular).                                                        |
| `source_filename` | string \| null            | No       | Original filename when loaded.                                                  |
| `loaded_at`       | string (ISO 8601)         | No       |                                                                                 |
| `edited_at`       | string (ISO 8601) \| null | No       |                                                                                 |

---

## 5. `knowledge`

Markdown documents embedded in the file that teach the AI about the business.
Loaded automatically before relevant LLM calls.

```json
{
  "knowledge": [
    {
      "name": "chart-of-accounts",
      "scope": "chat+workflow",
      "tags": ["coa", "classification"],
      "content": "# Chart of Accounts\n\n- 6240 Travel Meals (max $75/day)\n- 6250 Entertainment (receipt required > $25)\n..."
    },
    {
      "name": "privacy-map",
      "scope": "privacy-map",
      "content": "Smithco Industries\nJohn Smith\nFirst National Bank\n"
    }
  ]
}
```

| Field        | Type              | Required | Description                                                |
| ------------ | ----------------- | -------- | ---------------------------------------------------------- |
| `name`       | string            | Yes      | Unique name. Used in `{{name}}` references from workflows. |
| `scope`      | string            | Yes      | When the pack is loaded — see below.                       |
| `tags`       | string[]          | No       | Tags for organization. Default: `[]`.                      |
| `content`    | string            | Yes      | Markdown content.                                          |
| `created_at` | string (ISO 8601) | No       |                                                            |
| `updated_at` | string (ISO 8601) | No       |                                                            |

### Scopes

| Scope           | Loaded for                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat`          | Chat / AI operations only.                                                                                                                                                    |
| `workflow`      | Workflow runtime only (via `api.getKnowledge()`).                                                                                                                             |
| `chat+workflow` | Both. The default for most user packs.                                                                                                                                        |
| `privacy-map`   | Special — entity-masking layer. Lines are entity names that get tokenized to `«E1»`, `«E2»`, … before any LLM call, and unmasked on response. Never sent to the LLM directly. |

---

## 6. `sessions`

Saved workflow runs and chat conversations. Each session captures what
happened: which workflow ran, the messages exchanged, the final state.
Shared `.wfp` files typically include zero or a small handful of sessions
(starter examples). A working file may have many.

Sessions are also the home for voice / chat history — a chat thread IS a
session of type `"chat"`.

### Session policy

A runner MUST create a session whenever it persists runtime state that
outlives the current workflow execution. This includes, at minimum:

- chat / voice turns (via `api.appendChat`),
- pause state from `api.pauseForInput` (so the run can be resumed after a
  page reload or process restart),
- any audit, replay, or progress data the runner exposes to the user.

A runner that has no such state to persist (a pure "open file, run, see
output, close" flow) MAY leave `sessions` empty. The choice is local to the
runner — but if any runtime state is kept, it is kept here.

```json
{
  "sessions": [
    {
      "id": "sess-abc123",
      "name": "Morning categorization run",
      "workflow_id": "wf-categorize",
      "kind": "automation",
      "status": "completed",
      "created_at": "2026-05-21T08:30:00.000Z",
      "updated_at": "2026-05-21T08:31:14.000Z",
      "completed_at": "2026-05-21T08:31:14.000Z",
      "messages": [
        {
          "id": "m1",
          "role": "user",
          "timestamp": "2026-05-21T08:30:00.000Z",
          "markdown": "Run the categorizer on April."
        },
        {
          "id": "m2",
          "role": "assistant",
          "timestamp": "2026-05-21T08:31:14.000Z",
          "node_id": "n-categorize",
          "node_label": "Categorize",
          "markdown": "Categorized 89 transactions. 3 needed review."
        }
      ],
      "parameters": [{ "name": "month", "type": "string", "value": "2026-04" }],
      "metadata": {}
    },
    {
      "id": "sess-care-2026-05-19",
      "name": "Caregiver chat",
      "workflow_id": "wf-care01",
      "kind": "chat",
      "status": "completed",
      "created_at": "2026-05-19T22:00:00.000Z",
      "updated_at": "2026-05-19T22:47:30.000Z",
      "messages": [
        {
          "id": "t1",
          "role": "user",
          "timestamp": "2026-05-19T22:47:29.885Z",
          "markdown": "what is on the list"
        },
        {
          "id": "t2",
          "role": "assistant",
          "timestamp": "2026-05-19T22:47:30.110Z",
          "markdown": "Marie still has all ten tasks for today..."
        }
      ]
    }
  ]
}
```

### Session

| Field          | Type              | Required | Description                                                                                                               |
| -------------- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`           | string            | Yes      | Unique session ID.                                                                                                        |
| `name`         | string            | No       | Human-readable session name.                                                                                              |
| `workflow_id`  | string            | No       | Which workflow this session is associated with (if any). Chat sessions may run multiple.                                  |
| `kind`         | string            | No       | `"automation"` or `"chat"`. Default: `"automation"`.                                                                      |
| `status`       | string            | Yes      | `"pending"`, `"in_progress"`, `"awaiting_feedback"`, `"awaiting_approval"`, `"completed"`, `"cancelled"`, or `"blocked"`. |
| `messages`     | Message[]         | No       | Conversation / progress messages. Default: `[]`.                                                                          |
| `parameters`   | Parameter[]       | No       | Session-scoped parameters set during the run.                                                                             |
| `metadata`     | object            | No       | Free-form. Approval tokens, retry counts, etc.                                                                            |
| `created_at`   | string (ISO 8601) | Yes      |                                                                                                                           |
| `updated_at`   | string (ISO 8601) | Yes      |                                                                                                                           |
| `completed_at` | string (ISO 8601) | No       | Set when `status` is `"completed"`.                                                                                       |

### Message

| Field        | Type              | Required | Description                                                                                                              |
| ------------ | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`         | string            | Yes      | Unique within the session.                                                                                               |
| `role`       | string            | Yes      | `"user"`, `"assistant"`, `"system"`, `"tool"`, `"error"`, `"info"`, `"audit"`, `"form"`, `"todo"`, or `"chat_msg_sent"`. |
| `timestamp`  | string (ISO 8601) | Yes      |                                                                                                                          |
| `markdown`   | string            | No       | Plain markdown body.                                                                                                     |
| `html`       | string            | No       | Rendered HTML body (when the writer chose to pre-render).                                                                |
| `node_id`    | string            | No       | The workflow node that generated this message.                                                                           |
| `node_label` | string            | No       | Human-readable node label.                                                                                               |
| `tool_id`    | string            | No       | Tool that generated the message.                                                                                         |
| `json`       | object            | No       | Structured payload.                                                                                                      |
| `data`       | array             | No       | Tabular payload.                                                                                                         |
| `table`      | object            | No       | `{ data, columns, options }` — see types.                                                                                |
| `chart`      | object            | No       | `{ type, data, options }` — see types.                                                                                   |
| `form`       | object            | No       | Form definition for interactive prompts.                                                                                 |

### Parameter

| Field      | Type    | Required | Description                                                    |
| ---------- | ------- | -------- | -------------------------------------------------------------- |
| `name`     | string  | Yes      |                                                                |
| `type`     | string  | Yes      | `"string"`, `"number"`, `"boolean"`, `"object"`, or `"array"`. |
| `value`    | any     | Yes      |                                                                |
| `required` | boolean | No       |                                                                |
| `default`  | any     | No       |                                                                |

---

## 7. `extensions`

Anything that isn't one of the six core concepts above goes here. Each entry is
namespaced by key. Runners ignore extensions they don't understand but **MUST
preserve them byte-equivalent (or structurally equivalent JSON) on save** —
this is one application of the broader [round-trip rule](#the-round-trip-rule)
that lets a simple runner edit a workflow in a file written by a feature-rich
runner without losing data.

```json
{
  "extensions": {
    "app": {
      "wake_word": "computer",
      "voice_workflow_id": "wf-care01",
      "default_workflow": "wf-dashboard",
      "theme": "dark"
    },
    "todos": [
      {
        "id": "todo-1",
        "label": "Build expense review workflow",
        "instruction": "/wf-build categorize and review monthly expenses",
        "status": "pending",
        "sort_order": 0,
        "source": "planner",
        "category": "build"
      }
    ],
    "audit": [
      {
        "id": "evt-1",
        "timestamp": "2026-05-21T15:30:00.000Z",
        "actor": "tad@workflowpeople.com",
        "kind": "workflow.update",
        "target": "wf-categorize",
        "summary": "Renamed node 'Brain' → 'Categorize'"
      }
    ],
    "modules": ["wfp_gl:1.0"]
  }
}
```

### Naming rules

- Extension keys are ASCII identifiers matching `[a-z0-9_]+`.
- The reserved short keys are: `app`, `todos`, `audit`, `dashboard`, `modules`.
- Vendor-specific extensions MUST use a vendor prefix: `acme_*`.

### Standard extensions

These are _conventions_, not required. A runner that uses them follows the same
shapes so other runners can preserve them sensibly.

#### `extensions.app`

Per-workspace runner settings: wake word, default workflow, theme, etc. All
fields are optional and runner-specific.

#### `extensions.todos`

Workspace todo list. Each: `{ id?, label, instruction?, status, sort_order?, source?, category?, created_at?, updated_at? }`. Status: `pending | in_progress | done | cancelled`.

#### `extensions.audit`

Append-only build/run audit trail. Each: `{ id, timestamp, actor?, kind, target?, summary?, detail? }`.

#### `extensions.dashboard`

Workspace-level chat history that isn't tied to a single workflow run (the home
chat). `{ messages: Message[] }` — same `Message` shape as `sessions[].messages`.

#### `extensions.modules`

A list of versioned external service identifiers the workspace expects (e.g.,
`"wfp_gl:1.0"`). The file format doesn't define what these mean — it's a
suggestion to the runner about which external services to enable when the file
loads.

### The round-trip rule

This is the only compatibility rule in the spec, and it is mandatory:

> Any conformant runner that loads a `.wfp` file and writes it back MUST
> preserve every top-level key it did not actively manage, and every key
> inside `extensions` it did not understand, byte-equivalent (or
> structurally-equivalent JSON) to what it read.

A runner MAY transform keys it actively manages. It MUST NOT silently drop,
rename, or restructure ones it does not. If a runner cannot guarantee
preservation (e.g., file-size limits), it MUST refuse to save and surface a
clear error.

**What this means in practice.** A browser-only runner that doesn't implement
sessions still reads `sessions` on load and writes them back unchanged on save.
A runner with no audit feature preserves `extensions.audit`. The principle: a
runner is a visitor — it MUST NOT delete data that other apps in the ecosystem
care about, even if it doesn't display or use that data itself. Only an
explicit user action in the runner (e.g., "Clear sessions", "Delete this
todo") may remove preserved data.

---

## Encryption Envelope

Any JSON value in a `.wfp` file MAY be replaced by an encryption envelope: a
discriminated object that holds ciphertext plus the parameters needed to
decrypt it. The envelope is recognized by the discriminator key `$wfp_enc`.

```json
{
  "$wfp_enc": "1",
  "alg": "AES-GCM-256",
  "kdf": "PBKDF2-SHA256",
  "iter": 600000,
  "salt": "base64url-...",
  "iv": "base64url-...",
  "aad": "base64url-...",
  "ct": "base64url-..."
}
```

| Field      | Required       | Description                                                                 |
| ---------- | -------------- | --------------------------------------------------------------------------- |
| `$wfp_enc` | Yes            | Envelope version. Current: `"1"`.                                           |
| `alg`      | Yes            | Symmetric cipher. Required: `"AES-GCM-256"`.                                |
| `kdf`      | Yes            | Key derivation. Required: `"PBKDF2-SHA256"` (or `"Argon2id"` if supported). |
| `iter`     | Yes (PBKDF2)   | Iteration count. Minimum: `600_000`.                                        |
| `mem`      | Yes (Argon2id) | Memory cost in KiB.                                                         |
| `salt`     | Yes            | Base64url random salt (≥16 bytes).                                          |
| `iv`       | Yes            | Base64url random IV / nonce (12 bytes for GCM).                             |
| `aad`      | No             | Base64url additional authenticated data. SHOULD include the segment path.   |
| `ct`       | Yes            | Base64url ciphertext (with the GCM tag appended).                           |
| `hint`     | No             | Human-readable hint about the password (NOT the password).                  |

The envelope is **value-level** — it can wrap the entire file, an entire branch
(`data`, `extensions.gl`), or a single value (`data.balance_sheet.content`).
Mixing plaintext and encrypted values in the same file is permitted and expected.

When per-segment encryption is used, all segments SHOULD derive their keys from
the same workspace password — one PBKDF2 call to produce a master key, then
HKDF per segment using the segment's path as `info`. This avoids re-running
expensive KDFs on every segment.

A reader that encounters an envelope it cannot decrypt (no password, wrong
password, unsupported `alg`) MUST treat it as opaque: preserve byte-equivalent
on save, surface a clear notice that the segment is locked, and continue to
operate on plaintext segments.

---

## Minimal Valid `.wfp`

The smallest file the spec allows: `metadata` plus one workflow.

```json
{
  "metadata": {
    "format_version": "1.0.0",
    "workspace": "Quick Analysis"
  },
  "workflows": [
    {
      "id": "wf-analyze",
      "name": "Analyze Data",
      "type": "automation",
      "nodes": [
        {
          "id": "s",
          "type": "start",
          "label": "Start",
          "step_order": 1,
          "tool_id": "workflow_start"
        },
        {
          "id": "a",
          "type": "tool",
          "label": "Analyze",
          "step_order": 2,
          "tool_id": "llm_step",
          "tool_parameters": {
            "data": "{{input}}",
            "instructions": "Flag any month-over-month variance over 10%."
          }
        },
        {
          "id": "e",
          "type": "end",
          "label": "Done",
          "step_order": 3,
          "tool_id": "workflow_end"
        }
      ]
    }
  ],
  "knowledge": [
    {
      "name": "input",
      "scope": "workflow",
      "content": "(placeholder — replaced by real data when the workflow runs)"
    }
  ]
}
```

---

## Conformance

A **conformant reader** MUST:

- Parse files declaring `metadata.format_version === "1.0.0"`.
- Preserve every top-level key it does not actively manage, and every key under
  `extensions` it does not understand, byte- or structurally-equivalent, on
  save. Only explicit user action may delete preserved data.
- Treat unrecognized encryption envelopes as opaque preserved values.

A **conformant writer** MUST:

- Set `metadata.format_version` to `"1.0.0"` (or higher).
- Set `metadata.workspace`.
- Include at least one workflow in `workflows`.
- Use real JSON arrays and objects everywhere — no JSON-stringified arrays.
- Use the snake_case key conventions defined in this spec.

A writer that cannot preserve unmanaged top-level keys or unknown extensions MUST refuse to save and
surface a clear error.

---

## What this spec deliberately does not include

A few things were left out so the format stays small. They live elsewhere:

| Concern                         | Where it lives                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| General Ledger data and reports | External service. Workflows reach it via `api.fetch()` and a knowledge pack that documents the service's endpoints. |
| Capability/feature negotiation  | Not needed. The round-trip rule + an envelope-locked unknown is sufficient.                                         |
| Database schema migrations      | Not the file format's concern.                                                                                      |
| Multi-user / firm-level packs   | A future spec extension. For now, those are merged into `knowledge` at load time by the host environment.           |
| Binary attachments              | Not in 1.0. Use a data URI inside `data.<name>.content` if needed.                                                  |

---

## License

MIT. Implement readers, writers, and runners in any language for any purpose.
