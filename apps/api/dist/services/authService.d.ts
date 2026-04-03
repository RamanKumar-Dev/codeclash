import { Request, Response, NextFunction } from 'express';
import { RedisClientType } from 'redis';
import { User } from '@code-clash/shared-types';
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface JwtPayload {
    userId: string;
    username: string;
    role: string;
    tokenType: 'access' | 'refresh';
}
export declare class AuthService {
    private redis;
    private readonly ACCESS_TOKEN_TTL;
    private readonly REFRESH_TOKEN_TTL;
    private readonly RATE_LIMIT_WINDOW;
    private readonly RATE_LIMIT_MAX;
    constructor(redis: RedisClientType);
    generateTokens(user: User): Promise<AuthTokens>;
    verifyAccessToken(token: string): Promise<JwtPayload>;
    refreshAccessToken(refreshToken: string): Promise<string>;
    revokeRefreshToken(userId: string, refreshToken: string): Promise<void>;
    revokeAllRefreshTokens(userId: string): Promise<void>;
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
    generateVerificationToken(): string;
    generatePasswordResetToken(): {
        token: string;
        expires: Date;
    };
    checkRateLimit(identifier: string, ip: string): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
    }>;
    sendVerificationEmail(user: User): Promise<void>;
    verifyEmail(userId: string, token: string): Promise<boolean>;
    sendPasswordResetEmail(user: User): Promise<void>;
    verifyPasswordResetToken(userId: string, token: string): Promise<boolean>;
    clearPasswordResetToken(userId: string): Promise<void>;
}
export declare function authenticateToken(authService: AuthService): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare function requireRole(requiredRole: 'admin' | 'moderator'): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function authRateLimit(authService: AuthService): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=authService.d.ts.map