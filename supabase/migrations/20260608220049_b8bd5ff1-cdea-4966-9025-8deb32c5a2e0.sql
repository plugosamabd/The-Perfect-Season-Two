
DROP POLICY IF EXISTS "anyone insert chat" ON public.chat_messages;
CREATE POLICY "anyone insert chat" ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    length(message) BETWEEN 1 AND 280
    AND length(player_name) BETWEEN 1 AND 40
    AND length(room_code) BETWEEN 1 AND 8
  );
