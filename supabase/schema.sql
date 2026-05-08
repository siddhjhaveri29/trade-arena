-- TradeArena Database Schema
-- Run this in the Supabase SQL Editor at https://app.supabase.com

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── portfolios ───────────────────────────────────────────────────────────────
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market TEXT NOT NULL CHECK (market IN ('IN', 'US')),
  cash_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  initial_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, market)
);

-- ─── positions ────────────────────────────────────────────────────────────────
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  display_name TEXT,
  market TEXT NOT NULL CHECK (market IN ('IN', 'US')),
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  quantity NUMERIC(18,6) NOT NULL,
  avg_price NUMERIC(18,4) NOT NULL,
  current_price NUMERIC(18,4) DEFAULT 0,
  unrealized_pnl NUMERIC(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, symbol, side)
);

-- ─── orders ───────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('IN', 'US')),
  order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit')),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  position_side TEXT NOT NULL CHECK (position_side IN ('long', 'short')),
  quantity NUMERIC(18,6) NOT NULL,
  limit_price NUMERIC(18,4),
  filled_price NUMERIC(18,4),
  filled_quantity NUMERIC(18,6) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'cancelled', 'rejected')),
  reject_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── trades ───────────────────────────────────────────────────────────────────
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  symbol TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('IN', 'US')),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  position_side TEXT NOT NULL CHECK (position_side IN ('long', 'short')),
  quantity NUMERIC(18,6) NOT NULL,
  price NUMERIC(18,4) NOT NULL,
  pnl NUMERIC(18,2) DEFAULT 0,
  pnl_percentage NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── journal_entries ──────────────────────────────────────────────────────────
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  symbol TEXT,
  market TEXT CHECK (market IN ('IN', 'US')),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  direction TEXT CHECK (direction IN ('long', 'short')),
  setup TEXT CHECK (setup IN ('breakout', 'reversal', 'trend_follow', 'news_play', 'earnings', 'other')),
  notes TEXT,
  lessons TEXT,
  emotion TEXT CHECK (emotion IN ('confident', 'anxious', 'greedy', 'fearful', 'neutral', 'excited')),
  emotion_rating INTEGER CHECK (emotion_rating BETWEEN 1 AND 5),
  outcome TEXT CHECK (outcome IN ('win', 'loss', 'breakeven')),
  pnl NUMERIC(18,2),
  tags TEXT[],
  screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── equity_snapshots ─────────────────────────────────────────────────────────
CREATE TABLE equity_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  equity NUMERIC(18,2) NOT NULL,
  cash NUMERIC(18,2) NOT NULL,
  positions_value NUMERIC(18,2) NOT NULL,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── groups ───────────────────────────────────────────────────────────────────
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('IN', 'US', 'BOTH')),
  competition_type TEXT CHECK (competition_type IN ('weekly', 'monthly', 'all_time')) DEFAULT 'all_time',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── group_members ────────────────────────────────────────────────────────────
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ─── watchlist_items ──────────────────────────────────────────────────────────
CREATE TABLE watchlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  display_name TEXT,
  market TEXT NOT NULL CHECK (market IN ('IN', 'US')),
  yahoo_key TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol, market)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE INDEX idx_positions_user ON positions(user_id);
CREATE INDEX idx_positions_portfolio ON positions(portfolio_id);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_portfolio ON orders(portfolio_id);
CREATE INDEX idx_trades_user ON trades(user_id);
CREATE INDEX idx_trades_portfolio ON trades(portfolio_id);
CREATE INDEX idx_journal_user_date ON journal_entries(user_id, entry_date);
CREATE INDEX idx_snapshots_portfolio_time ON equity_snapshots(portfolio_id, snapshot_at);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_watchlist_user ON watchlist_items(user_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

-- profiles: own row full access; anyone can read (for leaderboards)
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT USING (true);

-- portfolios: own only
CREATE POLICY "portfolios_own" ON portfolios FOR ALL USING (auth.uid() = user_id);

-- positions: own only (but group members can read via server-side service role)
CREATE POLICY "positions_own" ON positions FOR ALL USING (auth.uid() = user_id);

-- orders: own only
CREATE POLICY "orders_own" ON orders FOR ALL USING (auth.uid() = user_id);

-- trades: own only; group members can read other members' trades
CREATE POLICY "trades_own" ON trades FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "trades_group_read" ON trades FOR SELECT USING (
  user_id IN (
    SELECT gm2.user_id FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid()
  )
);

-- journal_entries: own only
CREATE POLICY "journal_own" ON journal_entries FOR ALL USING (auth.uid() = user_id);

-- equity_snapshots: own only
CREATE POLICY "snapshots_own" ON equity_snapshots FOR ALL USING (auth.uid() = user_id);

-- groups: creator or member can read; only creator can insert/update
CREATE POLICY "groups_read" ON groups FOR SELECT USING (
  auth.uid() = created_by
  OR id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);
CREATE POLICY "groups_insert" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups_update" ON groups FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "groups_delete" ON groups FOR DELETE USING (auth.uid() = created_by);

-- group_members: own row; members of same group can read all member rows
CREATE POLICY "group_members_own" ON group_members FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "group_members_read" ON group_members FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

-- watchlist: own only
CREATE POLICY "watchlist_own" ON watchlist_items FOR ALL USING (auth.uid() = user_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_portfolios_updated BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_positions_updated BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_journal_updated BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
