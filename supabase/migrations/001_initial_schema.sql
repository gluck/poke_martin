-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles: read all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Dresseur'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PLAYERS
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players: read own" ON public.players FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Players: insert own" ON public.players FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Players: update own" ON public.players FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Players: delete own" ON public.players FOR DELETE USING (user_id = auth.uid());

-- POKEMON INSTANCES
CREATE TABLE IF NOT EXISTS public.pokemon_instances (
  id BIGSERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  pokedex_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  french_name TEXT NOT NULL,
  sprite TEXT NOT NULL,
  types TEXT[] NOT NULL,
  base_stats JSONB NOT NULL,
  abilities TEXT[] NOT NULL,
  cry_url TEXT,
  base_experience INTEGER NOT NULL DEFAULT 50,
  level INTEGER NOT NULL DEFAULT 5,
  current_xp INTEGER NOT NULL DEFAULT 0,
  growth_rate_id TEXT NOT NULL DEFAULT 'medium',
  evolution_chain_id INTEGER NOT NULL DEFAULT 0,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('team', 'reserve')),
  slot_index INTEGER NOT NULL DEFAULT 0,
  UNIQUE(player_id, pokedex_id)
);
CREATE INDEX IF NOT EXISTS idx_pokemon_player ON public.pokemon_instances(player_id);

ALTER TABLE public.pokemon_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pokemon: manage own" ON public.pokemon_instances FOR ALL USING (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.user_id = auth.uid())
);

-- FRIENDSHIPS
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id) WHERE status = 'pending';

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friendships: read own" ON public.friendships FOR SELECT USING (
  requester_id = auth.uid() OR addressee_id = auth.uid()
);
CREATE POLICY "Friendships: send request" ON public.friendships FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Friendships: addressee update" ON public.friendships FOR UPDATE USING (addressee_id = auth.uid());

-- BATTLE CHALLENGES
CREATE TABLE IF NOT EXISTS public.battle_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenger_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_player_id UUID REFERENCES public.players(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);
CREATE INDEX IF NOT EXISTS idx_challenges_opponent ON public.battle_challenges(opponent_id) WHERE status = 'pending';

ALTER TABLE public.battle_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Challenges: read own" ON public.battle_challenges FOR SELECT USING (
  challenger_id = auth.uid() OR opponent_id = auth.uid()
);
CREATE POLICY "Challenges: create" ON public.battle_challenges FOR INSERT WITH CHECK (challenger_id = auth.uid());
CREATE POLICY "Challenges: opponent update" ON public.battle_challenges FOR UPDATE USING (opponent_id = auth.uid());

-- BATTLE HISTORY
CREATE TABLE IF NOT EXISTS public.battle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  winner_player_id UUID REFERENCES public.players(id),
  rounds JSONB NOT NULL,
  xp_gains JSONB NOT NULL,
  player1_snapshot JSONB NOT NULL,
  player2_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_battle_history_p1 ON public.battle_history(player1_id);
CREATE INDEX IF NOT EXISTS idx_battle_history_p2 ON public.battle_history(player2_id);

ALTER TABLE public.battle_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "History: read own" ON public.battle_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.user_id = auth.uid()
      AND (p.id = player1_id OR p.id = player2_id)
  )
);

-- Enable realtime for challenges and friendships
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
