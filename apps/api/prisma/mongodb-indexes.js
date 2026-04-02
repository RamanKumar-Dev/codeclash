-- MongoDB Indexes for Code-Clash Production
-- Optimized for high-performance queries and scalability

-- Users collection indexes
db.users.createIndex({ "username": 1 }, { unique: true, name: "idx_username_unique" })
db.users.createIndex({ "email": 1 }, { unique: true, name: "idx_email_unique" })
db.users.createIndex({ "elo": -1 }, { name: "idx_elo_desc" })
db.users.createIndex({ "createdAt": -1 }, { name: "idx_created_at_desc" })
db.users.createIndex({ "lastActiveAt": -1 }, { name: "idx_last_active_desc" })
db.users.createIndex({ "isOnline": 1, "lastActiveAt": -1 }, { name: "idx_online_status" })
db.users.createIndex({ "isVerified": 1, "elo": -1 }, { name: "idx_verified_elo" })

-- Problems collection indexes
db.problems.createIndex({ "title": "text", "description": "text" }, { name: "idx_text_search" })
db.problems.createIndex({ "difficulty": 1, "elo": 1 }, { name: "idx_difficulty_elo" })
db.problems.createIndex({ "isActive": 1, "createdAt": -1 }, { name: "idx_active_created" })
db.problems.createIndex({ "category": 1, "difficulty": 1 }, { name: "idx_category_difficulty" })
db.problems.createIndex({ "submissionCount": -1 }, { name: "idx_submission_count_desc" })
db.problems.createIndex({ "avgSuccessRate": -1 }, { name: "idx_success_rate_desc" })

-- Battles collection indexes
db.battles.createIndex({ "player1Id": 1, "createdAt": -1 }, { name: "idx_player1_created" })
db.battles.createIndex({ "player2Id": 1, "createdAt": -1 }, { name: "idx_player2_created" })
db.battles.createIndex({ "status": 1, "createdAt": -1 }, { name: "idx_status_created" })
db.battles.createIndex({ "winnerId": 1, "createdAt": -1 }, { name: "idx_winner_created" })
db.battles.createIndex({ "roomId": 1 }, { unique: true, name: "idx_room_id_unique" })
db.battles.createIndex({ "createdAt": -1 }, { name: "idx_created_at_desc" })
db.battles.createIndex({ "battleType": 1, "status": 1 }, { name: "idx_type_status" })

-- Submissions collection indexes
db.submissions.createIndex({ "userId": 1, "createdAt": -1 }, { name: "idx_user_created" })
db.submissions.createIndex({ "problemId": 1, "createdAt": -1 }, { name: "idx_problem_created" })
db.submissions.createIndex({ "battleId": 1, "createdAt": -1 }, { name: "idx_battle_created" })
db.submissions.createIndex({ "language": 1, "createdAt": -1 }, { name: "idx_language_created" })
db.submissions.createIndex({ "passedTests": -1, "totalTests": -1, "execTimeMs": 1 }, { name: "idx_performance" })
db.submissions.createIndex({ "createdAt": -1 }, { expireAfterSeconds: 2592000, name: "idx_ttl_30d" }) -- Auto-delete after 30 days

-- PuzzleBenchmarks collection indexes
db.puzzlebenchmarks.createIndex({ "puzzleId": 1, "language": 1 }, { unique: true, name: "idx_puzzle_language_unique" })
db.puzzlebenchmarks.createIndex({ "avgRuntimeMs": 1 }, { name: "idx_avg_runtime" })

-- Leaderboard collection indexes (if using separate collection)
db.leaderboard.createIndex({ "period": 1, "rank": 1 }, { name: "idx_period_rank" })
db.leaderboard.createIndex({ "userId": 1, "period": 1 }, { unique: true, name: "idx_user_period_unique" })
db.leaderboard.createIndex({ "elo": -1, "period": 1 }, { name: "idx_elo_period_desc" })

-- Friends collection indexes
db.friends.createIndex({ "userId": 1, "status": 1 }, { name: "idx_user_status" })
db.friends.createIndex({ "friendId": 1, "status": 1 }, { name: "idx_friend_status" })
db.friends.createIndex({ "userId": 1, "friendId": 1 }, { unique: true, name: "idx_user_friend_unique" })

-- Notifications collection indexes
db.notifications.createIndex({ "userId": 1, "isRead": 1, "createdAt": -1 }, { name: "idx_user_read_created" })
db.notifications.createIndex({ "createdAt": -1 }, { expireAfterSeconds: 2592000, name: "idx_ttl_30d" }) -- Auto-delete after 30 days

-- ChatMessages collection indexes
db.chatmessages.createIndex({ "roomId": 1, "timestamp": -1 }, { name: "idx_room_timestamp" })
db.chatmessages.createIndex({ "userId": 1, "timestamp": -1 }, { name: "idx_user_timestamp" })
db.chatmessages.createIndex({ "timestamp": -1 }, { expireAfterSeconds: 604800, name: "idx_ttl_7d" }) -- Auto-delete after 7 days

-- Sessions collection indexes (for session management)
db.sessions.createIndex({ "sessionId": 1 }, { unique: true, name: "idx_session_id_unique" })
db.sessions.createIndex({ "userId": 1, "expiresAt": -1 }, { name: "idx_user_expires" })
db.sessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0, name: "idx_auto_cleanup" })

-- AuditLogs collection indexes
db.auditlogs.createIndex({ "userId": 1, "timestamp": -1 }, { name: "idx_user_timestamp" })
db.auditlogs.createIndex({ "action": 1, "timestamp": -1 }, { name: "idx_action_timestamp" })
db.auditlogs.createIndex({ "timestamp": -1 }, { expireAfterSeconds: 7776000, name: "idx_ttl_90d" }) -- Auto-delete after 90 days

-- Create compound indexes for common query patterns
db.users.createIndex({ "isOnline": 1, "isSearching": 1, "elo": -1 }, { name: "idx_matchmaking" })
db.battles.createIndex({ "status": 1, "battleType": 1, "createdAt": -1 }, { name: "idx_active_battles" })
db.submissions.createIndex({ "userId": 1, "problemId": 1, "passedTests": -1 }, { name: "idx_user_problem_best" })

-- Create partial indexes for better performance
db.users.createIndex({ "lastActiveAt": -1 }, { 
  partialFilterExpression: { "isOnline": true }, 
  name: "idx_online_users_only" 
})

db.battles.createIndex({ "createdAt": -1 }, { 
  partialFilterExpression: { "status": "active" }, 
  name: "idx_active_battles_only" 
})

-- Print index statistics
print("MongoDB indexes created successfully!")
print("Index statistics:")
db.users.getIndexes().forEach(idx => print(`users.${idx.name}: ${JSON.stringify(idx.key)}`))
db.problems.getIndexes().forEach(idx => print(`problems.${idx.name}: ${JSON.stringify(idx.key)}`))
db.battles.getIndexes().forEach(idx => print(`battles.${idx.name}: ${JSON.stringify(idx.key)}`))
db.submissions.getIndexes().forEach(idx => print(`submissions.${idx.name}: ${JSON.stringify(idx.key)}`))
