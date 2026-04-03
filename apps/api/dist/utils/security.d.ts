export declare class SecurityService {
    static sanitizeHtml(html: string): string;
    static sanitizeText(text: string): string;
    static sanitizeMongoQuery(query: any): any;
    static sanitizePuzzleContent(puzzle: any): any;
    static sanitizeUserProfile(profile: any): any;
    static sanitizeChatMessage(message: string): string;
    static containsXSS(input: string): boolean;
    static isValidFileType(filename: string, allowedTypes: string[]): boolean;
    static validateContentCreation(user: any, content: any): {
        valid: boolean;
        error?: string;
    };
}
//# sourceMappingURL=security.d.ts.map