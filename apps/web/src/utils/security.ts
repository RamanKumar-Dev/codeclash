import DOMPurify from 'dompurify';

export class SecurityUtils {
  // Sanitize HTML content for safe rendering
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

  // Sanitize user input for display
  static sanitizeText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
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

  // Safe JSON parsing
  static safeJsonParse<T>(json: string, fallback: T): T {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
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

  // Validate URL
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  // Validate and sanitize chat message
  static sanitizeChatMessage(message: string): string {
    return this.sanitizeText(message).substring(0, 500); // Limit length
  }

  // Create safe content renderer component
  static createSafeRenderer() {
    return (content: string) => {
      const sanitized = this.sanitizeHtml(content);
      return { __html: sanitized };
    };
  }
}

// React component for safe HTML rendering
export const SafeHTMLRenderer: React.FC<{ content: string }> = ({ content }) => {
  const sanitizedContent = SecurityUtils.sanitizeHtml(content);
  
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      className="prose prose-sm max-w-none"
    />
  );
};

// React component for safe text rendering
export const SafeTextRenderer: React.FC<{ content: string; className?: string }> = ({ 
  content, 
  className = '' 
}) => {
  const sanitizedContent = SecurityUtils.sanitizeText(content);
  
  return <span className={className}>{sanitizedContent}</span>;
};
