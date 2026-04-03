import { Request, Response, NextFunction } from 'express';
interface JWTPayload {
    userId: string;
    username: string;
    email: string;
}
export declare class AuthMiddleware {
    private static JWT_SECRET;
    private static JWT_EXPIRES_IN;
    static rateLimiter: import("express-rate-limit").RateLimitRequestHandler;
    static generateToken(user: {
        id: string;
        username: string;
        email: string;
    }): string;
    static verifyToken(token: string): JWTPayload;
    static hashPassword(password: string): Promise<string>;
    static verifyPassword(password: string, hash: string): Promise<boolean>;
    static authenticate: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    static register(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    static login(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    static getProfile(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export {};
//# sourceMappingURL=auth.d.ts.map