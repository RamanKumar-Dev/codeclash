"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityService = void 0;
const isomorphic_dompurify_1 = __importDefault(require("isomorphic-dompurify"));
const mongo_sanitize_1 = __importDefault(require("mongo-sanitize"));
class SecurityService {
    // Sanitize HTML content for frontend display
    static sanitizeHtml(html) {
        return isomorphic_dompurify_1.default.sanitize(html, {
            ALLOWED_TAGS: [
                'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
                'code', 'pre', 'span', 'div'
            ],
            ALLOWED_ATTR: ['class'],
            ALLOW_DATA_ATTR: false
        });
    }
    // Sanitize user-generated text content
    static sanitizeText(text) {
        if (!text)
            return '';
        return text
            .replace(/[<>]/g, '') // Remove HTML tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .replace(/data:/gi, '') // Remove data: protocol
            .trim();
    }
    // Sanitize MongoDB queries to prevent NoSQL injection
    static sanitizeMongoQuery(query) {
        return (0, mongo_sanitize_1.default)(query);
    }
    // Validate and sanitize puzzle content
    static sanitizePuzzleContent(puzzle) {
        return {
            ...puzzle,
            title: this.sanitizeText(puzzle.title || ''),
            description: this.sanitizeHtml(puzzle.description || ''),
            constraints: this.sanitizeText(puzzle.constraints || ''),
            examples: puzzle.examples?.map((example) => ({
                input: this.sanitizeText(example.input || ''),
                output: this.sanitizeText(example.output || ''),
                explanation: this.sanitizeHtml(example.explanation || '')
            })) || []
        };
    }
    // Validate and sanitize user profile data
    static sanitizeUserProfile(profile) {
        return {
            ...profile,
            username: this.sanitizeText(profile.username || ''),
            bio: this.sanitizeText(profile.bio || ''),
            displayName: this.sanitizeText(profile.displayName || '')
        };
    }
    // Validate and sanitize chat messages
    static sanitizeChatMessage(message) {
        return this.sanitizeText(message).substring(0, 500); // Limit length
    }
    // Check for potential XSS patterns
    static containsXSS(input) {
        const xssPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe\b[^>]*>/gi,
            /<object\b[^>]*>/gi,
            /<embed\b[^>]*>/gi,
            /data:text\/html/gi
        ];
        return xssPatterns.some(pattern => pattern.test(input));
    }
    // Validate file upload content type
    static isValidFileType(filename, allowedTypes) {
        const extension = filename.split('.').pop()?.toLowerCase();
        return extension ? allowedTypes.includes(extension) : false;
    }
    // Rate limiting for content creation
    static validateContentCreation(user, content) {
        // Check if user is verified
        if (!user.isVerified) {
            return { valid: false, error: 'User must be verified to create content' };
        }
        // Check content length
        if (content.description && content.description.length > 10000) {
            return { valid: false, error: 'Content description too long' };
        }
        // Check for XSS patterns
        if (this.containsXSS(content.description || '')) {
            return { valid: false, error: 'Content contains potentially harmful scripts' };
        }
        return { valid: true };
    }
}
exports.SecurityService = SecurityService;
//# sourceMappingURL=security.js.map