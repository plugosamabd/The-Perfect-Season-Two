
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL DEFAULT 'lobby',
  p1_id TEXT,
  p2_id TEXT,
  p1_name TEXT,
  p2_name TEXT,
  current_turn INT NOT NULL DEFAULT 1,
  pick_index INT NOT NULL DEFAULT 0,
  spin_result JSONB,
  p1_team JSONB NOT NULL DEFAULT '[]'::jsonb,
  p2_team JSONB NOT NULL DEFAULT '[]'::jsonb,
  p1_record JSONB,
  p2_record JSONB,
  tiebreaker JSONB,
  winner INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read rooms" ON public.rooms FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

CREATE INDEX rooms_code_idx ON public.rooms(code);
