# .wfp — Workflow People File Format

A `.wfp` file is a portable, self-contained JSON document that encodes a complete finance workflow — process steps, data, custom logic, and domain knowledge — in a format that is human-readable, machine-executable, and shareable.

## What is it for?

Finance professionals share `.wfp` files the way they share spreadsheets — except a `.wfp` captures the **process**, not just the data. Bank categorization, expense allocation, invoice aging, month-end close — any repeatable accounting workflow can be packaged as a `.wfp` file.

## How to use a .wfp file

**Option 1: Run it in the app**
Load the file at [workflowpeople.com](https://workflowpeople.com) — full execution with custom tools, data management, and session history.

**Option 2: Paste it into any LLM**
Copy the contents of a `.wfp` file and paste it into Claude, ChatGPT, or Gemini along with the [LLM Prompt Runner](./RUNNER.md). The LLM will interpret and execute the workflow steps. You get ~80% of the value without installing anything.

## Repository contents

```
├── SPEC.md              # Complete format specification (v2)
├── RUNNER.md            # LLM prompt runner — paste into any AI chat
├── README.md            # This file
├── LICENSE              # MIT
└── examples/
    ├── bank_categorization.wfp
    └── small_biz_bookkeeping.wfp
```

## The spec_url field

Every `.wfp` file includes a `spec_url` in its metadata:

```json
{
  "meta": {
    "format_version": 2,
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
    "format_version": 2,
    "spec_url": "https://raw.githubusercontent.com/workflowpeople/wfp-format/main/SPEC.md",
    "exported_at": "2026-04-11T10:00:00.000Z",
    "workspace": "My Workflow"
  },
  "app_workflows": [
    {
      "workflow_id": "wf-001",
      "name": "Categorize Transactions",
      "summary": "Classify bank transactions into chart of accounts categories",
      "nodes": "[{\"id\":\"n1\",\"type\":\"start\",\"step_order\":1},{\"id\":\"n2\",\"type\":\"tool\",\"tool_id\":\"llm_step\",\"step_order\":2,\"toolParameters\":{\"prompt\":\"Categorize each transaction...\"}}]",
      "edges": "[]"
    }
  ]
}
```

## License

MIT
