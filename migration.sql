-- 장기 멀티플레이 DB 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- 주의: players 테이블은 스도쿠/체스와 공유합니다.
-- players 테이블이 아직 없다면 먼저 스도쿠 migration을 실행하세요.

-- 공유 players 테이블에 장기 컬럼 추가
ALTER TABLE players ADD COLUMN IF NOT EXISTS janggi_games_played INT DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS janggi_games_won INT DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS janggi_total_score INT DEFAULT 0;

-- 장기 방 테이블
CREATE TABLE janggi_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id UUID REFERENCES players(id),
  board JSONB,
  turn TEXT NOT NULL DEFAULT 'cho',
  status TEXT NOT NULL DEFAULT 'waiting',
  host_side TEXT NOT NULL DEFAULT 'cho',
  winner_id UUID REFERENCES players(id),
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 장기 방 참가자 테이블
CREATE TABLE janggi_room_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES janggi_rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  side TEXT NOT NULL DEFAULT 'han',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, player_id)
);

-- RLS 활성화
ALTER TABLE janggi_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE janggi_room_players ENABLE ROW LEVEL SECURITY;

-- 공개 접근 정책
CREATE POLICY "public_janggi_rooms" ON janggi_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_janggi_room_players" ON janggi_room_players FOR ALL USING (true) WITH CHECK (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE janggi_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE janggi_room_players;
