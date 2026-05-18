<p align="center">
  <img src="./logo/wfp-logo.svg" alt=".wfp format" width="280" />
</p>

<h1 align="center">.wfp — Workflow People File Format</h1>

<p align="center">
  A portable, self-contained JSON document that bundles a finance workflow — process steps, custom logic, domain knowledge, and data — in a format that is human-readable, machine-executable, and shareable.
</p>

---

## What is it for?

Finance professionals share `.wfp` files the way they share spreadsheets — except a `.wfp` captures the **process**, not just the data. Bank categorization, expense allocation, invoice aging, month-end close — any repeatable accounting workflow can be packaged as a `.wfp` file.

What sits inside a single `.wfp`:

- **Workflows** — ordered steps with dependencies
- **Custom tools** — JavaScript snippets the runtime executes
- **Knowledge packs** — markdown that teaches an AI about the business (chart of accounts, tax rules, close procedures)
- **User data** — CSVs, JSON, or text the workflow operates on
- **General Ledger** — optional embedded GL tables (journal, openings, budget, accounts) for QBO-style analysis
- **Todos** — workspace task list for multi-step projects

## How to use a .wfp file

**Option 1: Run it in the app**
Load the file at [workflowpeople.com](https://workflowpeople.com) — full execution with custom tools, data management, session history, and GL reporting.

**Option 2: Paste it into any LLM**
Copy the contents of a `.wfp` file and paste it into Claude, ChatGPT, or Gemini along with the [LLM Prompt Runner](./RUNNER.md). The LLM will interpret and execute the workflow steps. You get ~80% of the value without installing anything.

## Knowledge packs — the domain context layer

Knowledge packs are markdown documents embedded directly in the `.wfp` file. They teach the AI about the business: chart of accounts, tax classification rules, vendor lists, close procedures, API schemas. Every AI operation loads the relevant packs before calling the LLM, so the same workflow produces consistent, business-aware output across runs and across machines.

```json
{
  "app_knowledge_packs": [
    {
      "name": "chart-of-accounts",
      "scope": "chat+workflow",
      "tags": ["coa", "classification"],
      "content": "# Chart of Accounts\n\n- 6240 Travel Meals (max $75/day)\n- 6250 Entertainment (receipt required > $25)\n..."
    }
  ]
}
```

Packs are bundled with the file (not fetched from a server), which makes a `.wfp` fully reproducible: hand it to a colleague, open it on another machine, and the AI sees the same domain knowledge that produced the original results.

## Repository contents

```
├── SPEC.md              # Complete format specification (v3)
├── RUNNER.md            # LLM prompt runner — paste into any AI chat
├── README.md            # This file
├── LICENSE              # MIT
├── logo/
│   ├── wfp-icon.svg     # Briefcase icon (square, for favicons & badges)
│   └── wfp-logo.svg     # Full logo (briefcase + .wfp text)
└── examples/
    ├── bank_categorization.wfp
    └── small_biz_bookkeeping.wfp
```

## The spec_url field

Every `.wfp` file includes a `spec_url` in its metadata:

```json
{
  "meta": {
    "format_version": 3,
    "spec_url": "https://raw.githubusercontent.com/workflowpeople/wfp-format/main/SPEC.md",
    ...
  }
}
```

When you paste a `.wfp` file into an LLM, it can fetch this URL to understand the format — like a schema reference.

## Quick example

A minimal `.wfp` file:

```json
{
  "meta": {
    "format_version": 3,
    "spec_url": "https://raw.githubusercontent.com/workflowpeople/wfp-format/main/SPEC.md",
    "exported_at": "2026-05-17T10:00:00.000Z",
    "workspace": "My Workflow",
    "period": "April 2026"
  },
  "app_workflows": [
    {
      "workflow_id": "wf-001",
      "name": "Categorize Transactions",
      "summary": "Classify bank transactions into chart of accounts categories",
      "sort_order": 0,
      "nodes": "[{\"id\":\"n1\",\"type\":\"start\",\"step_order\":1},{\"id\":\"n2\",\"type\":\"tool\",\"tool_id\":\"llm_step\",\"step_order\":2,\"toolParameters\":{\"prompt\":\"Categorize each transaction using {{chart-of-accounts}}\"}}]",
      "edges": "[]"
    }
  ],
  "app_knowledge_packs": [
    {
      "name": "chart-of-accounts",
      "scope": "chat+workflow",
      "tags": ["coa"],
      "content": "# Chart of Accounts\n- 6240 Travel Meals\n- 5000 Rent\n..."
    }
  ]
}
```

## Format versions

| Version | Status | Notes |
|---|---|---|
| **3** | Current | Adds `app_knowledge_packs`, `app_workspace_todos`, `tool_data.wfp_gl` (unified GL with hierarchy + vendor/customer), workflow dependencies (`sort_order`, `depends_on`), `meta.period`, `meta.workspace_notes` |
| **2** | Legacy (still readable) | JSON format, `app_knowledge` (renamed to `app_knowledge_packs` in v3), `tool_data.gl` (legacy GL shape) |
| **1** | Legacy (still readable) | Section-based text format using `[START:section]...[END:section]` markers |

See [SPEC.md](./SPEC.md) for the full specification.

## License

MIT
