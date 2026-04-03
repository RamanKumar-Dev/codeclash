import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        email: string;
    };
}
export declare const authenticateToken: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const generateTokens: (userId: string) => {
    accessToken: string;
    refreshToken: string;
};
//# sourceMappingURL=auth.d.ts.map