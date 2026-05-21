-- Proposed SQLite schema for runtime chat state + inference telemetry

PRAGMA foreign_keys = ON;

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT
);

CREATE INDEX idx_messages_conversation_created_at
  ON messages (conversation_id, created_at);

CREATE TABLE turns (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  committed_assistant_message_id TEXT REFERENCES messages(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  error_message TEXT,
  metadata_json TEXT
);

CREATE INDEX idx_turns_conversation_created_at
  ON turns (conversation_id, created_at);

CREATE UNIQUE INDEX idx_turns_user_message_id
  ON turns (user_message_id);

CREATE TABLE inference_requests (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  request_id TEXT NOT NULL,
  provider_request_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'streaming', 'completed', 'failed', 'cancelled')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  latency_ms INTEGER,
  time_to_first_token_ms INTEGER,
  input_token_count INTEGER,
  output_token_count INTEGER,
  total_token_count INTEGER,
  stop_reason TEXT,
  error_code TEXT,
  error_message TEXT,
  input_preview TEXT,
  output_preview TEXT,
  raw_request_json TEXT,
  raw_response_json TEXT,
  metadata_json TEXT,
  UNIQUE (turn_id, attempt_number),
  UNIQUE (request_id)
);

CREATE INDEX idx_inference_requests_turn_attempt
  ON inference_requests (turn_id, attempt_number);

CREATE INDEX idx_inference_requests_provider_model_started_at
  ON inference_requests (provider, model, started_at);

CREATE TABLE inference_events (
  id TEXT PRIMARY KEY,
  inference_request_id TEXT NOT NULL REFERENCES inference_requests(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT,
  UNIQUE (inference_request_id, sequence_number)
);

CREATE INDEX idx_inference_events_request_sequence
  ON inference_events (inference_request_id, sequence_number);

-- Optional useful view for app + analytics queries
CREATE VIEW turn_summary AS
SELECT
  t.id AS turn_id,
  t.conversation_id,
  t.status AS turn_status,
  t.created_at AS turn_created_at,
  t.completed_at AS turn_completed_at,
  um.content AS user_message_content,
  am.content AS assistant_message_content,
  ir.id AS latest_inference_request_id,
  ir.provider AS latest_provider,
  ir.model AS latest_model,
  ir.status AS latest_inference_status,
  ir.latency_ms,
  ir.time_to_first_token_ms,
  ir.total_token_count
FROM turns t
JOIN messages um ON um.id = t.user_message_id
LEFT JOIN messages am ON am.id = t.committed_assistant_message_id
LEFT JOIN inference_requests ir ON ir.turn_id = t.id
WHERE ir.attempt_number = (
  SELECT MAX(ir2.attempt_number)
  FROM inference_requests ir2
  WHERE ir2.turn_id = t.id
) OR ir.id IS NULL;
