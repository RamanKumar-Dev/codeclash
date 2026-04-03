import { z } from 'zod';
export interface JwtPayload {
    userId: string;
    username: string;
    elo: number;
    iat?: number;
    exp?: number;
}
export declare function verifyJWT(token: string): JwtPayload;
export declare function generateJWT(payload: Omit<JwtPayload, 'iat' | 'exp'>): string;
export declare const QueueJoinSchema: z.ZodObject<{
    elo: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    elo: number;
}, {
    elo: number;
}>;
export declare const BattleSubmitSchema: z.ZodObject<{
    roomId: z.ZodString;
    puzzleId: z.ZodString;
    code: z.ZodString;
    language: z.ZodEnum<["python", "javascript", "java", "cpp"]>;
}, "strip", z.ZodTypeAny, {
    code: string;
    language: "python" | "javascript" | "java" | "cpp";
    roomId: string;
    puzzleId: string;
}, {
    code: string;
    language: "python" | "javascript" | "java" | "cpp";
    roomId: string;
    puzzleId: string;
}>;
export declare const SpellCastSchema: z.ZodObject<{
    roomId: z.ZodString;
    spellId: z.ZodString;
    targetUserId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    spellId: string;
    targetUserId?: string | undefined;
}, {
    roomId: string;
    spellId: string;
    targetUserId?: string | undefined;
}>;
export declare const BattleReadySchema: z.ZodObject<{
    roomId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
}, {
    roomId: string;
}>;
export declare const JoinRoomSchema: z.ZodObject<{
    roomId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
}, {
    roomId: string;
}>;
export declare const AuthSchema: z.ZodObject<{
    token: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    token: string;
    userId?: string | undefined;
}, {
    token: string;
    userId?: string | undefined;
}>;
export declare function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T;
export declare function sanitizeInput(input: string): string;
//# sourceMappingURL=validation.d.ts.map