CREATE TABLE IF NOT EXISTS gracz_chat_topics (
  topic_id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'ogólne',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS gracz_chat_topics_created_idx ON gracz_chat_topics(created_at DESC);

CREATE TABLE IF NOT EXISTS gracz_global_chat (
  message_id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL,
  reply_to UUID NULL,
  topic_id UUID NULL,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE gracz_global_chat ADD COLUMN IF NOT EXISTS topic_id UUID NULL;
CREATE INDEX IF NOT EXISTS gracz_global_chat_created_idx ON gracz_global_chat(created_at DESC);
CREATE INDEX IF NOT EXISTS gracz_global_chat_user_idx ON gracz_global_chat(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS gracz_global_chat_topic_idx ON gracz_global_chat(topic_id,created_at DESC);

CREATE TABLE IF NOT EXISTS gracz_chat_friends (
  relation_id UUID PRIMARY KEY,
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  addressee_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requester_id <> addressee_id),
  UNIQUE(requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS gracz_chat_friends_users_idx ON gracz_chat_friends(requester_id,addressee_id,status);

CREATE TABLE IF NOT EXISTS gracz_global_chat_reports (
  report_id UUID PRIMARY KEY,
  message_id UUID NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, reporter_id)
);
