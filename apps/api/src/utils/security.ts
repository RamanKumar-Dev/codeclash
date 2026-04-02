import DOMPurify from 'isomorphic-dompurify';
import mongoSanitize from 'mongo-sanitize';

export class SecurityService {
  // Sanitize HTML content for frontend display
  static sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
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
  static sanitizeText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/data:/gi, '') // Remove data: protocol
      .trim();
  }

  // Sanitize MongoDB queries to prevent NoSQL injection
  static sanitizeMongoQuery(query: any): any {
    return mongoSanitize(query);
  }

  // Validate and sanitize puzzle content
  static sanitizePuzzleContent(puzzle: any): any {
    return {
      ...puzzle,
      title: this.sanitizeText(puzzle.title || ''),
      description: this.sanitizeHtml(puzzle.description || ''),
      constraints: this.sanitizeText(puzzle.constraints || ''),
      examples: puzzle.examples?.map((example: any) => ({
        input: this.sanitizeText(example.input || ''),
        output: this.sanitizeText(example.output || ''),
        explanation: this.sanitizeHtml(example.explanation || '')
      })) || []
    };
  }

  // Validate and sanitize user profile data
  static sanitizeUserProfile(profile: any): any {
    return {
      ...profile,
      username: this.sanitizeText(profile.username || ''),
      bio: this.sanitizeText(profile.bio || ''),
      displayName: this.sanitizeText(profile.displayName || '')
    };
  }

  // Validate and sanitize chat messages
  static sanitizeChatMessage(message: string): string {
    return this.sanitizeText(message).substring(0, 500); // Limit length
  }

  // Check for potential XSS patterns
  static containsXSS(input: string): boolean {
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
  static isValidFileType(filename: string, allowedTypes: string[]): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
  }

  // Rate limiting for content creation
  static validateContentCreation(user: any, content: any): { valid: boolean; error?: string } {
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
