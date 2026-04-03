"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("redis");
const auth_1 = __importDefault(require("./routes/auth"));
const match_1 = __importDefault(require("./routes/match"));
const leaderboard_1 = __importDefault(require("./routes/leaderboard"));
const problem_1 = __importDefault(require("./routes/problem"));
const auth_2 = require("./middleware/auth");
const errorHandler_1 = require("./middleware/errorHandler");
const socketService_1 = require("./services/socketService");
const client_1 = require("@prisma/client");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Initialize Redis for Socket.io adapter
const pubClient = (0, redis_1.createClient)({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const subClient = pubClient.duplicate();
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"]
    },
    adapter: (0, redis_adapter_1.createAdapter)(pubClient, subClient)
});
exports.prisma = new client_1.PrismaClient();
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/match', auth_2.authenticateToken, match_1.default);
app.use('/api/leaderboard', leaderboard_1.default);
app.use('/api/problems', problem_1.default);
// Error handling
app.use(errorHandler_1.errorHandler);
// Socket.io setup
(0, socketService_1.setupSocketHandlers)(io);
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Code-Clash API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Shutting down gracefully...');
    await (0, socketService_1.cleanupSocketServices)();
    await exports.prisma.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('🔄 Shutting down gracefully...');
    await (0, socketService_1.cleanupSocketServices)();
    await exports.prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map