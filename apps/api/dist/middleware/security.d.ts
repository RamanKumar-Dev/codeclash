import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
export interface ValidationOptions {
    sanitize?: boolean;
    stripUnknown?: boolean;
}
export declare function validateRequest(schema: ZodSchema, source?: 'body' | 'query' | 'params', options?: ValidationOptions): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function sanitizeCodeMiddleware(req: Request, res: Response, next: NextFunction): void;
export declare function xssProtection(req: Request, res: Response, next: NextFunction): void;
export declare class SuspiciousActivityMonitor {
    private suspiciousIPs;
    private ipAttempts;
    private readonly MAX_ATTEMPTS;
    private readonly WINDOW_MS;
    isSuspicious(ip: string): boolean;
    recordAttempt(ip: string): boolean;
    clearSuspicious(ip: string): void;
}
export declare function suspiciousActivityMiddleware(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function verifyJWT(token: string): any;
export declare function authenticateToken(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireRole(roles: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function contentSecurityCheck(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requestSizeLimiter(maxSize?: number): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const corsOptions: {
    origin: string[];
    credentials: boolean;
    optionsSuccessStatus: number;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
};
export declare function securityHeaders(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=security.d.ts.map