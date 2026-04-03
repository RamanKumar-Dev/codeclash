"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
// GET /api/match/history
router.get('/history', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const matches = await index_1.prisma.match.findMany({
            where: {
                OR: [{ player1Id: userId }, { player2Id: userId }]
            },
            include: {
                player1: { select: { username: true } },
                player2: { select: { username: true } },
                winner: { select: { username: true } },
                problem: { select: { title: true, difficulty: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
        });
        const total = await index_1.prisma.match.count({
            where: {
                OR: [{ player1Id: userId }, { player2Id: userId }]
            }
        });
        res.json({
            matches,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/match/:id
router.get('/:id', async (req, res, next) => {
    try {
        const matchId = req.params.id;
        const userId = req.user.id;
        const match = await index_1.prisma.match.findFirst({
            where: {
                id: matchId,
                OR: [{ player1Id: userId }, { player2Id: userId }]
            },
            include: {
                player1: { select: { username: true } },
                player2: { select: { username: true } },
                winner: { select: { username: true } },
                problem: true,
                submissions: {
                    include: {
                        user: { select: { username: true } }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        if (!match) {
            return next((0, errorHandler_1.createError)('Match not found', 404));
        }
        res.json(match);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=match.js.map