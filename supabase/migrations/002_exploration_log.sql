CREATE TABLE IF NOT EXISTS public.exploration_log (
  id BIGSERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  explored_at DATE NOT NULL DEFAULT CURRENT_DATE,
  pokemon_id INTEGER NOT NULL,
  pokemon_data JSONB NOT NULL,
  captured BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_exploration_player_date ON public.exploration_log(player_id, explored_at);

ALTER TABLE public.exploration_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exploration: manage own" ON public.exploration_log FOR ALL USING (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid())
);
