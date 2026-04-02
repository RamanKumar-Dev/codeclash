export interface CodeBlocklist {
  python: string[];
  javascript: string[];
  java: string[];
  cpp: string[];
}

export const CODE_BLOCKLIST: CodeBlocklist = {
  python: [
    'os',
    'subprocess',
    'sys.exit',
    'exit(',
    'quit(',
    'open(',
    'file(',
    'input(',
    'raw_input(',
    'exec(',
    'eval(',
    'compile(',
    '__import__',
    'globals(',
    'locals(',
    'vars(',
    'dir(',
    'hasattr(',
    'getattr(',
    'setattr(',
    'delattr(',
    'callable(',
    'isinstance(',
    'issubclass(',
    'iter(',
    'next(',
    'memoryview(',
    'property(',
    'classmethod(',
    'staticmethod(',
    'super(',
    'type(',
  ],
  javascript: [
    'require(',
    'import(',
    'process.',
    'global.',
    'Buffer',
    'fs.',
    'child_process',
    'cluster',
    'vm.',
    'eval(',
    'Function(',
    'setTimeout(',
    'setInterval(',
    'setImmediate(',
    'clearTimeout(',
    'clearInterval(',
    'clearImmediate(',
  ],
  java: [
    'System.exit',
    'Runtime.getRuntime',
    'ProcessBuilder',
    'Process',
    'exec(',
    'Class.forName',
    'forName',
    'System.load',
    'System.loadLibrary',
    'SecurityManager',
    'AccessController',
    'Permission',
    'File(',
    'FileInputStream',
    'FileOutputStream',
    'Files.',
    'Paths.',
    'Path',
    'NetworkInterface',
    'InetAddress',
    'Socket',
    'ServerSocket',
    'URL',
    'URLConnection',
    'HttpURLConnection',
  ],
  cpp: [
    'system(',
    'exec(',
    'popen(',
    '_exit',
    'exit(',
    'abort(',
    'fork(',
    'vfork(',
    'clone(',
    'pthread_create',
    'CreateProcess',
    'ShellExecute',
    'WinExec',
    'LoadLibrary',
    'GetProcAddress',
    'fopen',
    'fread',
    'fwrite',
    'open(',
    'read(',
    'write(',
    'socket(',
    'connect(',
    'bind(',
    'listen(',
    'accept(',
    'send(',
    'recv(',
  ]
};

export function checkCodeBlocklist(code: string, language: string): { safe: boolean; violations: string[] } {
  const blocklist = CODE_BLOCKLIST[language as keyof CodeBlocklist];
  
  if (!blocklist) {
    return { safe: true, violations: [] };
  }

  const violations: string[] = [];
  const lowerCode = code.toLowerCase();

  for (const blockedTerm of blocklist) {
    if (lowerCode.includes(blockedTerm.toLowerCase())) {
      violations.push(blockedTerm);
    }
  }

  return {
    safe: violations.length === 0,
    violations
  };
}

export interface SecurityConfig {
  maxCpuTime: number; // seconds
  maxMemory: number; // MB
  maxOutputSize: number; // KB
  maxCodeLength: number; // characters
  allowedLanguages: string[];
}

export const SECURITY_CONFIG: SecurityConfig = {
  maxCpuTime: 5,
  maxMemory: 256,
  maxOutputSize: 64,
  maxCodeLength: 10000,
  allowedLanguages: ['python', 'javascript', 'java', 'cpp']
};

export function validateSecurityConstraints(code: string, language: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check code length
  if (code.length > SECURITY_CONFIG.maxCodeLength) {
    errors.push(`Code exceeds maximum length of ${SECURITY_CONFIG.maxCodeLength} characters`);
  }

  // Check language is allowed
  if (!SECURITY_CONFIG.allowedLanguages.includes(language)) {
    errors.push(`Language ${language} is not allowed`);
  }

  // Check for blocked terms
  const blocklistCheck = checkCodeBlocklist(code, language);
  if (!blocklistCheck.safe) {
    errors.push(`Code contains blocked terms: ${blocklistCheck.violations.join(', ')}`);
  }

  // Additional checks
  if (code.includes('http://') || code.includes('https://')) {
    errors.push('Code contains URLs which are not allowed');
  }

  if (code.includes('localhost') || code.includes('127.0.0.1')) {
    errors.push('Code contains localhost references which are not allowed');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
