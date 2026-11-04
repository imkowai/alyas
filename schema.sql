-- Alya's virtual-only economy; AniList remains the character catalogue.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS players (
 user_id TEXT PRIMARY KEY,
 credits INTEGER NOT NULL DEFAULT 1000 CHECK(credits >= 0),
 last_roll_at INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS character_mints (
 character_id INTEGER PRIMARY KEY,
 last_mint INTEGER NOT NULL DEFAULT 0 CHECK(last_mint >= 0)
);
CREATE TABLE IF NOT EXISTS cards (
 uid INTEGER PRIMARY KEY AUTOINCREMENT,
 anilist_character_id INTEGER NOT NULL,
 anilist_media_id INTEGER,
 character_name TEXT NOT NULL,
 media_name TEXT,
 image_url TEXT,
 owner_id TEXT NOT NULL REFERENCES players(user_id),
 rarity TEXT NOT NULL,
 mint_number INTEGER NOT NULL,
 edition TEXT NOT NULL DEFAULT 'standard',
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 UNIQUE(anilist_character_id,mint_number)
);
CREATE INDEX IF NOT EXISTS cards_owner ON cards(owner_id);
CREATE TABLE IF NOT EXISTS pending_rolls (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES players(user_id),
 character_id INTEGER NOT NULL,
 media_id INTEGER,
 name TEXT NOT NULL,
 anime TEXT,
 image TEXT,
 rarity TEXT NOT NULL,
 cost INTEGER NOT NULL CHECK(cost >= 0),
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pending_owner ON pending_rolls(owner_id,expires_at);
CREATE TABLE IF NOT EXISTS listings (
 card_uid INTEGER PRIMARY KEY REFERENCES cards(uid) ON DELETE CASCADE,
 seller_id TEXT NOT NULL REFERENCES players(user_id),
 price INTEGER NOT NULL CHECK(price > 0),
 listed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS listings_price ON listings(price);
CREATE TABLE IF NOT EXISTS boosts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_id TEXT NOT NULL REFERENCES players(user_id),
 boost_type TEXT NOT NULL CHECK(boost_type IN ('luck','credits')),
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
 UNIQUE(owner_id,boost_type)
);
CREATE TABLE IF NOT EXISTS active_boosts (
 owner_id TEXT NOT NULL REFERENCES players(user_id),
 boost_type TEXT NOT NULL CHECK(boost_type IN ('luck','credits')),
 expires_at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,boost_type)
);
CREATE TABLE IF NOT EXISTS crates (
 owner_id TEXT NOT NULL REFERENCES players(user_id),
 crate_type TEXT NOT NULL DEFAULT 'basic',
 quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
 PRIMARY KEY(owner_id,crate_type)
);
CREATE TABLE IF NOT EXISTS ledger (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 delta INTEGER NOT NULL,
 reason TEXT NOT NULL,
 card_uid INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS ledger_player ON ledger(user_id,id);
CREATE TABLE IF NOT EXISTS events (
 event_id TEXT PRIMARY KEY,
 status TEXT NOT NULL DEFAULT 'received',
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS config (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);