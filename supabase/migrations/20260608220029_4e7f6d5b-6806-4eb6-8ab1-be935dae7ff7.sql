
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS p3_id text,
  ADD COLUMN IF NOT EXISTS p4_id text,
  ADD COLUMN IF NOT EXISTS p3_name text,
  ADD COLUMN IF NOT EXISTS p4_name text,
  ADD COLUMN IF NOT EXISTS p3_team jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS p4_team jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS p3_record jsonb,
  ADD COLUMN IF NOT EXISTS p4_record jsonb,
  ADD COLUMN IF NOT EXISTS max_players int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS tiebreaker_players jsonb;

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL,
  player_name text NOT NULL,
  player_seat int,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone read chat" ON public.chat_messages;
DROP POLICY IF EXISTS "anyone insert chat" ON public.chat_messages;

CREATE POLICY "anyone read chat" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "anyone insert chat" ON public.chat_messages FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS chat_messages_room_idx ON public.chat_messages (room_code, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
