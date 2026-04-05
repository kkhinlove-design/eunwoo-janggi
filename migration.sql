-- 장기 멀티플레이 DB 마이그레이션
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE janggi_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  avatar_emoji TEXT DEFAULT '😊',
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  total_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE janggi_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id UUID REFERENCES janggi_players(id),
  board JSONB,
  turn TEXT NOT NULL DEFAULT 'cho',
  status TEXT NOT NULL DEFAULT 'waiting',
  host_side TEXT NOT NULL DEFAULT 'cho',
  winner_id UUID REFERENCES janggi_players(id),
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE janggi_room_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES janggi_rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES janggi_players(id),
  side TEXT NOT NULL DEFAULT 'han',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, player_id)
);

ALTER TABLE janggi_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE janggi_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE janggi_room_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_janggi_players" ON janggi_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_janggi_rooms" ON janggi_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_janggi_room_players" ON janggi_room_players FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE janggi_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE janggi_room_players;
