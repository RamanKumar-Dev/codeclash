-- Database optimization for Code-Clash production
-- Run these commands to optimize PostgreSQL performance

-- Create optimized indexes for frequently queried fields

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_elo_desc ON users(rank DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_banned ON users(banned) WHERE banned = true;

-- Matches table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_player1_status ON matches(player1_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_player2_status ON matches(player2_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_winner_status ON matches(winner_id, status) WHERE winner_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_completed ON matches(status, ended_at DESC) WHERE status = 'COMPLETED';

-- Problems table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problems_created_at ON problems(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problems_tags ON problems USING GIN(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problems_difficulty_created ON problems(difficulty, created_at DESC);

-- Submissions table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_user_created ON submissions(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_match_created ON submissions(match_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_problem_created ON submissions(problem_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_user_problem ON submissions(user_id, problem_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_passed_tests ON submissions(passed_tests DESC, total_tests DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_runtime ON submissions(exec_time_ms) WHERE exec_time_ms IS NOT NULL;

-- Battle spells table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battle_spells_match_created ON battle_spells(match_id, cast_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battle_spells_caster_created ON battle_spells(caster_id, cast_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battle_spells_type ON battle_spells(spell_type);

-- Battle damage table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battle_damage_match_created ON battle_damage(match_id, occurred_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battle_damage_source_created ON battle_damage(source_id, occurred_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_battle_damage_target_created ON battle_damage(target_id, occurred_at DESC);

-- Puzzle benchmarks table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_puzzle_benchmarks_puzzle_language ON puzzle_benchmarks(puzzle_id, language);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_puzzle_benchmarks_language_p50 ON puzzle_benchmarks(language, p50_runtime_ms);

-- Composite indexes for complex queries

-- Leaderboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_leaderboard ON users(rank DESC, wins DESC, losses ASC);

-- User match history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_user_history ON matches(player1_id, created_at DESC) WHERE player1_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_user_history_2 ON matches(player2_id, created_at DESC) WHERE player2_id IS NOT NULL;

-- Recent submissions for user profiles
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_user_recent ON submissions(user_id, created_at DESC, passed_tests DESC);

-- Match statistics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_stats ON matches(status, created_at, winner_id) WHERE status = 'COMPLETED';

-- Partial indexes for better performance on filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_active ON matches(status, created_at) WHERE status IN ('WAITING', 'COUNTDOWN', 'ACTIVE');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_successful ON submissions(user_id, passed_tests, total_tests) WHERE passed_tests = total_tests;

-- Create materialized views for complex aggregations

-- User statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats AS
SELECT 
    u.id,
    u.username,
    u.rank as elo,
    u.wins,
    u.losses,
    u.created_at,
    CASE 
        WHEN u.wins + u.losses > 0 THEN ROUND((u.wins::float / (u.wins + u.losses)) * 100, 2)
        ELSE 0 
    END as win_rate,
    COALESCE(s.total_submissions, 0) as total_submissions,
    COALESCE(s.avg_runtime, 0) as avg_runtime,
    COALESCE(s.success_rate, 0) as success_rate,
    u.banned
FROM users u
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_submissions,
        AVG(exec_time_ms) as avg_runtime,
        ROUND(AVG(passed_tests::float / total_tests) * 100, 2) as success_rate
    FROM submissions 
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY user_id
) s ON u.id = s.user_id;

-- Puzzle statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS puzzle_stats AS
SELECT 
    p.id,
    p.title,
    p.difficulty,
    p.created_at,
    COUNT(s.id) as total_submissions,
    COUNT(CASE WHEN s.passed_tests = s.total_tests THEN 1 END) as successful_submissions,
    ROUND(AVG(s.exec_time_ms), 2) as avg_runtime,
    ROUND(COUNT(CASE WHEN s.passed_tests = s.total_tests THEN 1 END) * 100.0 / COUNT(s.id), 2) as success_rate,
    p.tags
FROM problems p
LEFT JOIN submissions s ON p.id = s.problem_id
WHERE s.created_at > NOW() - INTERVAL '30 days' OR s.created_at IS NULL
GROUP BY p.id, p.title, p.difficulty, p.created_at, p.tags;

-- Create indexes on materialized views
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stats_elo ON user_stats(elo DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stats_win_rate ON user_stats(win_rate DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_puzzle_stats_difficulty ON puzzle_stats(difficulty);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_puzzle_stats_success_rate ON puzzle_stats(success_rate DESC);

-- Create functions for refreshing materialized views
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_puzzle_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY puzzle_stats;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled jobs (requires pg_cron extension)
-- Uncomment if you have pg_cron installed
-- SELECT cron.schedule('refresh-stats', '*/5 * * * *', 'SELECT refresh_user_stats(); SELECT refresh_puzzle_stats();');

-- Partitioning for large tables (if needed for high traffic)
-- Uncomment and modify based on your data volume

-- Partition submissions by month
-- CREATE TABLE submissions_partitioned (
--     LIKE submissions INCLUDING ALL
-- ) PARTITION BY RANGE (created_at);

-- CREATE TABLE submissions_2024_01 PARTITION OF submissions_partitioned
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- CREATE TABLE submissions_2024_02 PARTITION OF submissions_partitioned
--     FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Optimize table settings
ALTER TABLE users SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE matches SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE submissions SET (autovacuum_vacuum_scale_factor = 0.1);

-- Update statistics for better query planning
ANALYZE users;
ANALYZE matches;
ANALYZE submissions;
ANALYZE problems;
ANALYZE battle_spells;
ANALYZE battle_damage;
ANALYZE puzzle_benchmarks;

-- Create helpful queries for monitoring

-- Query to check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Query to check slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Query to check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Query to monitor cache hit ratio
SELECT 
    datname,
    numbackends,
    xact_commit,
    xact_rollback,
    blks_read,
    blks_hit,
    round(blks_hit::numeric / (blks_hit + blks_read) * 100, 2) as cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();
