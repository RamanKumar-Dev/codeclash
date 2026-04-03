"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = require("../index");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
// GET /api/problems
router.get('/', async (req, res, next) => {
    try {
        const difficulty = req.query.difficulty;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const where = difficulty ? { difficulty: difficulty.toUpperCase() } : {};
        const problems = await index_1.prisma.problem.findMany({
            where,
            select: {
                id: true,
                title: true,
                difficulty: true,
                tags: true,
                timeLimitMs: true,
                memoryLimitMb: true
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
        });
        const total = await index_1.prisma.problem.count({ where });
        res.json({
            problems,
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
// GET /api/problems/:id
router.get('/:id', async (req, res, next) => {
    try {
        const problemId = req.params.id;
        const problem = await index_1.prisma.problem.findUnique({
            where: { id: problemId },
            select: {
                id: true,
                title: true,
                description: true,
                difficulty: true,
                timeLimitMs: true,
                memoryLimitMb: true,
                tags: true
            }
        });
        if (!problem) {
            return next((0, errorHandler_1.createError)('Problem not found', 404));
        }
        res.json(problem);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=problem.js.map