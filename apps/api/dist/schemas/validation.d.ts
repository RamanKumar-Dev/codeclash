import { z } from 'zod';
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RegisterSchema: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    email: string;
    password: string;
}, {
    username: string;
    email: string;
    password: string;
}>;
export declare const QueueJoinSchema: z.ZodObject<{
    elo: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    elo: number;
}, {
    elo: number;
}>;
export declare const BattleSubmitSchema: z.ZodObject<{
    code: z.ZodString;
    language: z.ZodEnum<["python", "javascript", "cpp", "java", "go"]>;
    roomId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    language: "python" | "javascript" | "java" | "cpp" | "go";
    roomId: string;
}, {
    code: string;
    language: "python" | "javascript" | "java" | "cpp" | "go";
    roomId: string;
}>;
export declare const SpellCastSchema: z.ZodObject<{
    spellType: z.ZodEnum<["HEAL", "DAMAGE", "SHIELD", "TIME_FREEZE", "HINT", "SLOW"]>;
    roomId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    spellType: "HINT" | "TIME_FREEZE" | "SLOW" | "HEAL" | "DAMAGE" | "SHIELD";
}, {
    roomId: string;
    spellType: "HINT" | "TIME_FREEZE" | "SLOW" | "HEAL" | "DAMAGE" | "SHIELD";
}>;
export declare const ExecutionRequestSchema: z.ZodObject<{
    code: z.ZodString;
    language: z.ZodEnum<["python", "javascript", "cpp", "java", "go"]>;
    puzzleId: z.ZodString;
    userId: z.ZodString;
    roomId: z.ZodString;
    submissionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    code: string;
    language: "python" | "javascript" | "java" | "cpp" | "go";
    roomId: string;
    puzzleId: string;
    submissionId?: string | undefined;
}, {
    userId: string;
    code: string;
    language: "python" | "javascript" | "java" | "cpp" | "go";
    roomId: string;
    puzzleId: string;
    submissionId?: string | undefined;
}>;
export declare const PuzzleCreateSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    difficulty: z.ZodEnum<["EASY", "MEDIUM", "HARD"]>;
    timeLimitMs: z.ZodNumber;
    testCases: z.ZodArray<z.ZodObject<{
        input: z.ZodString;
        expectedOutput: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        input: string;
        expectedOutput: string;
        description?: string | undefined;
    }, {
        input: string;
        expectedOutput: string;
        description?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    testCases: {
        input: string;
        expectedOutput: string;
        description?: string | undefined;
    }[];
    timeLimitMs: number;
}, {
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    testCases: {
        input: string;
        expectedOutput: string;
        description?: string | undefined;
    }[];
    timeLimitMs: number;
}>;
export declare const PuzzleUpdateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodOptional<z.ZodEnum<["EASY", "MEDIUM", "HARD"]>>;
    timeLimitMs: z.ZodOptional<z.ZodNumber>;
    testCases: z.ZodOptional<z.ZodArray<z.ZodObject<{
        input: z.ZodString;
        expectedOutput: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        input: string;
        expectedOutput: string;
        description?: string | undefined;
    }, {
        input: string;
        expectedOutput: string;
        description?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | undefined;
    difficulty?: "EASY" | "MEDIUM" | "HARD" | undefined;
    testCases?: {
        input: string;
        expectedOutput: string;
        description?: string | undefined;
    }[] | undefined;
    timeLimitMs?: number | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    difficulty?: "EASY" | "MEDIUM" | "HARD" | undefined;
    testCases?: {
        input: string;
        expectedOutput: string;
        description?: string | undefined;
    }[] | undefined;
    timeLimitMs?: number | undefined;
}>;
export declare const UserUpdateSchema: z.ZodObject<{
    username: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    rank: z.ZodOptional<z.ZodNumber>;
    banned: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    username?: string | undefined;
    email?: string | undefined;
    rank?: number | undefined;
    banned?: boolean | undefined;
}, {
    username?: string | undefined;
    email?: string | undefined;
    rank?: number | undefined;
    banned?: boolean | undefined;
}>;
export declare const WSPayloadSchema: z.ZodObject<{
    event: z.ZodString;
    data: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    event: string;
    data?: unknown;
}, {
    event: string;
    data?: unknown;
}>;
export declare const WSAuthSchema: z.ZodObject<{
    token: z.ZodString;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
    token: string;
}, {
    userId: string;
    token: string;
}>;
export declare const RateLimitConfigSchema: z.ZodObject<{
    windowMs: z.ZodNumber;
    maxRequests: z.ZodNumber;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    windowMs: number;
    maxRequests: number;
    message?: string | undefined;
}, {
    windowMs: number;
    maxRequests: number;
    message?: string | undefined;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type QueueJoinInput = z.infer<typeof QueueJoinSchema>;
export type BattleSubmitInput = z.infer<typeof BattleSubmitSchema>;
export type SpellCastInput = z.infer<typeof SpellCastSchema>;
export type ExecutionRequestInput = z.infer<typeof ExecutionRequestSchema>;
export type PuzzleCreateInput = z.infer<typeof PuzzleCreateSchema>;
export type PuzzleUpdateInput = z.infer<typeof PuzzleUpdateSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
export type WSAuthInput = z.infer<typeof WSAuthSchema>;
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
export declare function formatValidationError(error: z.ZodError): string;
export declare function sanitizeCode(code: string): string;
export declare function sanitizeUserInput(input: string): string;
//# sourceMappingURL=validation.d.ts.map