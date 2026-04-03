"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEADERBOARD_KEYS = exports.RANK_TIERS = exports.LANGUAGE_CONFIG = exports.MATCHMAKING_CONFIG = exports.REDIS_KEYS = void 0;
// Redis key schemas
exports.REDIS_KEYS = {
    QUEUE: 'matchmaking:queue',
    BATTLE_ROOM: 'battle:room:',
    BATTLE_STATE: 'battle:state:',
    USER_SESSION: 'user:session:',
    BATTLE_PARTICIPANTS: 'battle:participants:',
    USER_BATTLE: 'user:battle:',
    SPELL_COOLDOWN: 'spell:cooldown:',
    ACTIVE_SPELLS: 'spell:active:',
};
// Matchmaking configuration
exports.MATCHMAKING_CONFIG = {
    INITIAL_ELO_WINDOW: 200,
    ELO_WINDOW_EXPANSION: 50,
    WINDOW_EXPANSION_INTERVAL: 10000, // 10 seconds
    MAX_ELO_WINDOW: 500,
    SCAN_INTERVAL: 2000, // 2 seconds
    QUEUE_TIMEOUT: 300000, // 5 minutes
    BATTLE_TIMEOUT: 1800000, // 30 minutes
    RECONNECT_TIMEOUT: 30000, // 30 seconds
};
exports.LANGUAGE_CONFIG = {
    javascript: {
        name: 'JavaScript',
        extension: 'js',
        dockerImage: 'node:18-alpine',
        runCommand: 'node solution.js'
    },
    python: {
        name: 'Python',
        extension: 'py',
        dockerImage: 'python:3.12-slim',
        runCommand: 'python solution.py'
    },
    java: {
        name: 'Java',
        extension: 'java',
        dockerImage: 'openjdk:17-slim',
        compileCommand: 'javac Solution.java',
        runCommand: 'java Solution'
    },
    cpp: {
        name: 'C++',
        extension: 'cpp',
        dockerImage: 'gcc:latest',
        compileCommand: 'g++ -std=c++17 -O2 solution.cpp -o solution',
        runCommand: './solution'
    }
};
exports.RANK_TIERS = {
    STONE: {
        name: 'Stone',
        icon: '🪨',
        color: 'text-gray-500',
        minElo: 0,
        maxElo: 899,
        borderColor: 'border-gray-500',
        bgColor: 'bg-gray-500/20'
    },
    BRONZE: {
        name: 'Bronze',
        icon: '🥉',
        color: 'text-orange-600',
        minElo: 900,
        maxElo: 1099,
        borderColor: 'border-orange-600',
        bgColor: 'bg-orange-600/20'
    },
    SILVER: {
        name: 'Silver',
        icon: '🥈',
        color: 'text-gray-300',
        minElo: 1100,
        maxElo: 1299,
        borderColor: 'border-gray-300',
        bgColor: 'bg-gray-300/20'
    },
    GOLD: {
        name: 'Gold',
        icon: '🥇',
        color: 'text-yellow-500',
        minElo: 1300,
        maxElo: 1499,
        borderColor: 'border-yellow-500',
        bgColor: 'bg-yellow-500/20'
    },
    DIAMOND: {
        name: 'Diamond',
        icon: '💎',
        color: 'text-blue-500',
        minElo: 1500,
        maxElo: 1699,
        borderColor: 'border-blue-500',
        bgColor: 'bg-blue-500/20'
    },
    GRANDMASTER: {
        name: 'Grandmaster',
        icon: '👑',
        color: 'text-purple-500',
        minElo: 1700,
        maxElo: Infinity,
        borderColor: 'border-purple-500',
        bgColor: 'bg-purple-500/20'
    }
};
// Redis key schemas for leaderboards
exports.LEADERBOARD_KEYS = {
    SEASON: (seasonId) => `leaderboard:season:${seasonId}`,
    ALLTIME: 'leaderboard:alltime',
    WEEKLY: 'leaderboard:weekly',
    USER_RANK: (userId, type) => `rank:${type}:${userId}`,
    SEASON_INFO: 'season:current',
    ELO_JOURNEY: (userId, seasonId) => `journey:${seasonId}:${userId}`
};
