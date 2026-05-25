/**
 * .wfp File Format — TypeScript Types (1.0.0)
 *
 * Canonical types for the simplified .wfp format defined in
 *   ./README.md
 *
 * The spec is the source of truth. This file mirrors it for TypeScript
 * implementers (runners, hosted apps, third-party tooling). If the spec
 * and this file disagree, the spec wins.
 *
 * MIT License.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Top-level file
// ─────────────────────────────────────────────────────────────────────────────

/** A complete .wfp workspace document. */
export interface WfpFile {
  metadata: Metadata;
  workflows: Workflow[];
  tools?: Tool[];
  data?: Record<string, DataEntry>;
  knowledge?: KnowledgePack[];
  sessions?: Session[];
  extensions?: Extensions;
}

/**
 * The on-disk shape — either a plaintext document or a whole-file encryption
 * envelope. Use {@link isEncryptionEnvelope} to discriminate.
 */
export type WfpFileOrEncrypted = WfpFile | EncryptionEnvelope;

/** The current format version this file describes. */
export const WFP_FORMAT_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────────────────────────
// metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface Metadata {
  /** Semver. Current: "1.0.0". */
  format_version: string;

  /** Human-readable workspace name. */
  workspace: string;

  /** Canonical spec URL — useful when an LLM receives a pasted .wfp. */
  spec_url?: string;

  /** ISO 8601 timestamp. */
  exported_at?: string;

  /** Period label, e.g. "April 2026", "FY2026 Q1". */
  period?: string;

  /** Markdown persona applied across the workspace. */
  persona?: string;

  notes?: WorkspaceNote[];
}

export interface WorkspaceNote {
  text: string;
  /** ISO 8601 timestamp. */
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// workflows
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowKind = "automation" | "chat";

export interface Workflow {
  /** Unique within the file. */
  id: string;
  /** Unique within the file. */
  name: string;
  description?: string;
  /** Default: "automation". */
  type?: WorkflowKind;
  nodes: Node[];

  summary?: string;
  /** Display order in the workspace dashboard (0-based). */
  sort_order?: number;
  /** Workflow IDs this workflow depends on. */
  depends_on?: string[];
  /** ISO 8601 timestamp. */
  created_at?: string;
  /** ISO 8601 timestamp. */
  updated_at?: string;
}

export type NodeKind = "start" | "end" | "tool" | "prompt";

export interface Node {
  /** Unique within the workflow. */
  id: string;
  /** UI hint only. Dispatch is driven by `tool_id`, not `type`. */
  type: NodeKind;
  label: string;
  /** Execution order (1-based). */
  step_order: number;

  /**
   * Tool to execute. For start/end markers use `"workflow_start"` /
   * `"workflow_end"`. See README §3 "Reserved tool IDs".
   */
  tool_id: string;
  /** Static config: provider, model, etc. */
  tool_config?: Record<string, unknown>;
  /** Runtime parameters. Values may reference data via `{{name}}`. */
  tool_parameters?: Record<string, unknown>;
  workflow_mgmt?: WorkflowMgmt;
}

/**
 * The four built-in tool IDs reserved by the spec. A `.wfp` file MUST NOT
 * declare a custom tool with one of these IDs.
 */
export type BuiltinToolId =
  | "workflow_start"
  | "workflow_end"
  | "llm_step"
  | "chat_download";

/** Runtime set of reserved built-in IDs for cheap membership checks. */
export const BUILTIN_TOOL_IDS: ReadonlySet<BuiltinToolId> = new Set([
  "workflow_start",
  "workflow_end",
  "llm_step",
  "chat_download",
]);

export interface WorkflowMgmt {
  requires_approval?: boolean;
  approver_email?: string;
  approver_role?: string;
  approval_message?: string;
  send_email?: boolean;
  email_to?: string;
  email_subject?: string;
  email_body?: string;
  /** Status message shown in chat when this step completes. */
  chat_msg?: string;
  sla_hours?: number;
  budgeted_hours?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// tools
// ─────────────────────────────────────────────────────────────────────────────

export type ToolInputType =
  | "string" | "number" | "boolean" | "object" | "array" | "filepath";

export type ToolOutputType =
  | "string" | "number" | "boolean" | "object" | "array";

export interface Tool {
  tool_id: string;
  name: string;
  description: string;
  /** Longer markdown description. */
  description_md?: string;
  /** Grouping (e.g. "bookkeeping", "reporting"). */
  category?: string;
  /** Optional hex override for the category dot. */
  color?: string;
  /** Semver. Runners refuse to load tools whose major version doesn't match. */
  api_version: string;
  inputs: ToolInput[];
  outputs: ToolOutput[];
  /** JavaScript function body. Receives a single `api` argument. */
  code: string;

  /** Whether end-users may edit the code. Default: true. */
  allow_custom_code?: boolean;
  /** Tool may be invoked directly from chat (not only inside a workflow). */
  chat_runnable?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ToolInput {
  name: string;
  type: ToolInputType;
  required?: boolean;
  description?: string;
  default?: unknown;
  /** Restricted set of values (dropdown). */
  enum?: string[];
}

export interface ToolOutput {
  name: string;
  type: ToolOutputType;
  description?: string;
  example?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// data
// ─────────────────────────────────────────────────────────────────────────────

export type ContentType = "csv" | "json_array" | "json_object" | "text";

export interface DataEntry {
  /** Raw content. May be replaced by an EncryptionEnvelope. */
  content: string | EncryptionEnvelope;
  /** Default: "text". */
  content_type?: ContentType;
  /** Pre-parsed structured form (for json_array, json_object). */
  content_json?: unknown;
  /** Column names (for tabular). */
  columns?: string[];
  /** Row count (for tabular). */
  row_count?: number;
  /** Original filename when loaded. */
  source_filename?: string | null;
  /** ISO 8601 timestamp. */
  loaded_at?: string;
  /** ISO 8601 timestamp. */
  edited_at?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// knowledge
// ─────────────────────────────────────────────────────────────────────────────

export type KnowledgeScope =
  | "chat"          // chat / AI operations only
  | "workflow"      // workflow runtime only (via api.getKnowledge())
  | "chat+workflow" // both (default for most user packs)
  | "privacy-map";  // entity-masking layer — never sent to the LLM directly

export interface KnowledgePack {
  /** Unique name. Used in `{{name}}` references. */
  name: string;
  scope: KnowledgeScope;
  /** Default: []. */
  tags?: string[];
  /** Markdown content. */
  content: string;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// sessions
// ─────────────────────────────────────────────────────────────────────────────

export type SessionStatus =
  | "pending"
  | "in_progress"
  | "awaiting_feedback"
  | "awaiting_approval"
  | "completed"
  | "cancelled"
  | "blocked";

export type SessionKind = "automation" | "chat";

export interface Session {
  id: string;
  name?: string;
  /** Workflow this session is associated with. Chat sessions may run several. */
  workflow_id?: string;
  /** Default: "automation". */
  kind?: SessionKind;
  status: SessionStatus;

  messages?: Message[];
  parameters?: SessionParameter[];
  /** Free-form: approval tokens, retry counts, etc. */
  metadata?: Record<string, unknown>;

  /** ISO 8601 timestamp. */
  created_at: string;
  /** ISO 8601 timestamp. */
  updated_at: string;
  /** Set when status is "completed". */
  completed_at?: string;
}

export type MessageRole =
  | "user"
  | "assistant"
  | "system"
  | "tool"
  | "error"
  | "info"
  | "audit"
  | "form"
  | "todo"
  | "chat_msg_sent";

export interface Message {
  id: string;
  role: MessageRole;
  /** ISO 8601 timestamp. */
  timestamp: string;

  /** Plain markdown body. */
  markdown?: string;
  /** Rendered HTML body (when the writer chose to pre-render). */
  html?: string;
  /**
   * Spoken-line body. Runners with a TTS engine speak it; others render the
   * text as a normal log line.
   */
  voice?: string;
  /** Workflow node that generated this message. */
  node_id?: string;
  node_label?: string;
  tool_id?: string;
  /** Structured payload. */
  json?: Record<string, unknown>;
  /** Tabular payload (raw row array). */
  data?: unknown[];

  table?: TableContent;
  chart?: ChartContent;
  form?: FormContent;
}

export type ParameterType =
  | "string" | "number" | "boolean" | "object" | "array";

export interface SessionParameter {
  name: string;
  type: ParameterType;
  value: unknown;
  required?: boolean;
  default?: unknown;
}

// Rich message bodies ─────────────────────────────────────────────────────────

export interface TableContent {
  data: unknown[];
  columns?: TableColumn[];
  options?: Record<string, unknown>;
}

export interface TableColumn {
  name: string;
  type: "text" | "number" | "currency" | "percentage" | "date";
  align?: "left" | "right" | "center";
  width?: string;
}

export interface ChartContent {
  type: "bar" | "pie" | "line" | "progress";
  data: ChartData;
  options?: Record<string, unknown>;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
}

export interface FormContent {
  fields: FormField[];
  /** Endpoint that receives the submitted form. */
  endpoint?: string;
}

export interface FormField {
  name: string;
  type: "text" | "textarea" | "number" | "date" | "boolean" | "select";
  label: string;
  description?: string;
  required?: boolean;
  value?: unknown;
  /** For select fields. */
  options?: { value: string; label: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// extensions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional, namespaced extensions. Runners MUST preserve any keys they do not
 * understand byte-equivalent (or structurally equivalent JSON) on save.
 *
 * The known short keys are reserved: app, todos, audit, dashboard, modules.
 * Vendor-specific extensions MUST use a vendor prefix (e.g. `acme_payroll`).
 */
export interface Extensions {
  app?: AppExtension;
  todos?: TodoEntry[];
  audit?: AuditEntry[];
  dashboard?: DashboardExtension;
  /** Versioned external service IDs the workspace expects, e.g. "wfp_gl:1.0". */
  modules?: string[];
  /** Vendor or unknown extensions. */
  [key: string]: unknown;
}

/** Per-workspace runner settings. All fields optional and runner-specific. */
export interface AppExtension {
  wake_word?: string;
  voice_workflow_id?: string;
  default_workflow?: string;
  theme?: string;
  [key: string]: unknown;
}

export type TodoStatus = "pending" | "in_progress" | "done" | "cancelled";

export interface TodoEntry {
  id?: string;
  label: string;
  /** Pre-filled session instruction (e.g. "/wf-build expense review"). */
  instruction?: string;
  status: TodoStatus;
  /** Display order (0-based). */
  sort_order?: number;
  /** "planner" | "user" | "audit" | "system" | "session:<id>". */
  source?: string;
  /** "build" | "data" | "knowledge" | "review" | "general". */
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuditEntry {
  id: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Email, user ID, "system", or "runner:<name>". */
  actor?: string;
  /** Dotted event kind, e.g. "workflow.update", "tool.create". */
  kind: string;
  /** Affected entity ID. */
  target?: string;
  summary?: string;
  detail?: unknown;
}

/** Workspace-level chat history that isn't tied to a single workflow run. */
export interface DashboardExtension {
  messages: Message[];
}

// ─────────────────────────────────────────────────────────────────────────────
// encryption envelope
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Any JSON value in a .wfp may be replaced by this envelope. Recognized by
 * the discriminator `$wfp_enc`.
 */
export interface EncryptionEnvelope {
  /** Envelope version. Current: "1". */
  $wfp_enc: "1";
  /** Symmetric cipher. */
  alg: "AES-GCM-256";
  /** Key derivation function. */
  kdf: "PBKDF2-SHA256" | "Argon2id";
  /** PBKDF2 iteration count (required when kdf = PBKDF2-SHA256). Min 600_000. */
  iter?: number;
  /** Argon2id memory cost in KiB (required when kdf = Argon2id). */
  mem?: number;
  /** Base64url random salt (≥16 bytes). */
  salt: string;
  /** Base64url random IV / nonce (12 bytes for GCM). */
  iv: string;
  /** Base64url additional authenticated data. SHOULD include segment path. */
  aad?: string;
  /** Base64url ciphertext (with the GCM tag appended). */
  ct: string;
  /** Human-readable hint about the password (NOT the password). */
  hint?: string;
}

/** Type guard for {@link EncryptionEnvelope}. */
export function isEncryptionEnvelope(v: unknown): v is EncryptionEnvelope {
  return (
    typeof v === "object" &&
    v !== null &&
    "$wfp_enc" in (v as Record<string, unknown>)
  );
}
