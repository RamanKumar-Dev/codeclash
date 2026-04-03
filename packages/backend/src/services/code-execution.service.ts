import { TRPCError } from "@trpc/server";
import { existsSync, readdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { $ } from "zx";

export interface TestCase {
  input: string;
  expected: string;
  output: string;
  result: boolean;
  runtimeError?: string;
}

export interface CodeExecutionResult {
  compileError?: string;
  numPassed: number;
  numFailed: number;
  cases: TestCase[];
  executionTime: number;
  runtimeMs: number;
}

export interface LanguageConfig {
  ext: string;
  compile?: string;
  run: string;
}

// Enhanced language configs from Lootcode
export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  python: { ext: "py", run: `python3 solution.py` },
  java: {
    ext: "java",
    compile: `javac solution.java`,
    run: `java solution`,
  },
  c: {
    ext: "c",
    compile: `gcc solution.c -o solution.out -lm`,
    run: `./solution.out`,
  },
  cpp: {
    ext: "cpp",
    compile: `g++ solution.cpp -o solution.out -lm`,
    run: `./solution.out`,
  },
  csharp: {
    ext: "cs",
    compile: `mcs solution.cs`,
    run: `mono solution.exe`,
  },
  rust: {
    ext: "rs",
    compile: `rustc solution.rs -o solution`,
    run: `./solution`,
  },
  go: {
    ext: "go",
    run: `go run solution.go`,
  },
};

export class CodeExecutionService {
  private static readonly MAX_TRANSMIT = 2000;
  private static readonly DEFAULT_TIMEOUT = 1; // seconds

  static async executeCode(
    code: string,
    language: string,
    testCases: { input: string; expected: string }[],
    puzzleName?: string,
    userId?: string,
    timeout?: number
  ): Promise<CodeExecutionResult> {
    $.verbose = false;

    const langConfig = LANGUAGE_CONFIGS[language];
    if (!langConfig) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid language",
      });
    }

    const executionId = this.generateExecutionId();
    const workDir = `./temp/${executionId}`;
    const codePath = `${workDir}/solution`;

    // Create working directory
    await $`mkdir -p ${workDir}`;

    try {
      // Handle special cases based on puzzle name (from Lootcode)
      let processedCode = this.preprocessCode(code, puzzleName);
      
      // Handle Java class name (from Lootcode)
      if (langConfig.ext === "java") {
        const regex = /public\s+class\s+_?\w+/;
        if (processedCode.search(regex) === -1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A public class is required!",
          });
        }
        processedCode = processedCode.replace(regex, `public class solution`);
      }

      // Write code to file
      await writeFile(`${codePath}.${langConfig.ext}`, processedCode);

      // Create Docker container (from Lootcode)
      await $`docker run --network none --name ${executionId} --rm -i -d -v ${workDir}:/app/ code-runner`;

      // Compile if necessary
      if (langConfig.compile) {
        try {
          await $`cd ${workDir} && ${langConfig.compile}`;
        } catch (error: any) {
          return {
            compileError: this.cutData(
              (error.stderr as string).replaceAll(executionId, ""),
              this.MAX_TRANSMIT
            ),
            numPassed: 0,
            numFailed: testCases.length,
            cases: [],
            executionTime: 0,
            runtimeMs: 0,
          };
        }
      }

      // Execute test cases
      const results: TestCase[] = [];
      const actualTimeout = timeout ?? this.DEFAULT_TIMEOUT;
      let totalRuntime = 0;

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const result: TestCase = {
          input: this.cutData(testCase.input, this.MAX_TRANSMIT),
          expected: this.cutData(testCase.expected, this.MAX_TRANSMIT),
          output: "",
          result: false,
        };

        try {
          const startTime = Date.now();
          
          // Create shell script for this test case
          await writeFile(
            `${workDir}/test_${i}.sh`,
            `timeout ${actualTimeout}s ${langConfig.run} << 'EOF'\n${testCase.input}\nEOF`
          );

          // Execute in Docker container
          await $`docker exec -i ${executionId} /bin/bash < ${workDir}/test_${i}.sh > ${workDir}/output_${i}.txt`;
          
          totalRuntime += Date.now() - startTime;

          // Read output
          const output = await $`cat ${workDir}/output_${i}.txt`;
          result.output = this.cutData(output.stdout, this.MAX_TRANSMIT);

          // Compare output (ignore trailing whitespace)
          const expectedOutput = testCase.expected.replace(/\s+$/, "");
          const userOutput = output.stdout.replace(/\s+$/, "");

          result.result = expectedOutput === userOutput;
        } catch (error: any) {
          if (error.exitCode === 124) {
            result.runtimeError = "Time limit exceeded";
            result.output = "Time limit exceeded";
          } else {
            result.runtimeError = this.cutData(
              error.stderr as string,
              this.MAX_TRANSMIT
            );
            result.output = this.cutData(
              result.runtimeError.replaceAll(executionId, ""),
              this.MAX_TRANSMIT
            );
          }
        }

        results.push(result);
      }

      // Calculate statistics
      const numPassed = results.filter(r => r.result).length;
      const numFailed = results.length - numPassed;

      return {
        numPassed,
        numFailed,
        cases: results,
        executionTime: totalRuntime,
        runtimeMs: totalRuntime,
      };
    } finally {
      // Cleanup
      await $`docker rm ${executionId} -f`;
      await $`rm -rf ${workDir}`;
    }
  }

  private static preprocessCode(code: string, puzzleName?: string): string {
    if (!puzzleName) return code;

    let processedCode = code;

    // Special case handling from Lootcode
    switch (puzzleName) {
      case "merger":
        processedCode = processedCode.replaceAll(/[+\-*/]/g, "");
        break;
      case "gargantuan":
        processedCode = processedCode.replaceAll(
          /set_int_max_str_digits|BigInteger/g,
          ""
        );
        break;
      // Add more special cases as needed
    }

    return processedCode;
  }

  private static getTimeoutForPuzzle(puzzleName?: string, defaultTimeout?: number): number {
    if (puzzleName === "the_pebble") {
      return 5; // Special timeout for this puzzle
    }
    return defaultTimeout ?? this.DEFAULT_TIMEOUT;
  }

  static async createExecutionContainer(): Promise<string> {
    $.verbose = false;
    
    const executionId = this.generateExecutionId();
    const workDir = `./temp/${executionId}`;
    
    await $`mkdir -p ${workDir}`;
    
    // Create isolated Docker container
    await $`docker run --network none --name ${executionId} --rm -i -d -v ${workDir}:/app/ code-runner`;
    
    return executionId;
  }

  private static generateExecutionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private static cutData(data: string, cutoff: number): string {
    if (data.length > cutoff) {
      return (
        data.substring(0, cutoff) +
        "... " +
        (data.length - cutoff) +
        " MORE CHARACTERS."
      );
    }
    return data;
  }

  // Enhanced language support
  static getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_CONFIGS);
  }

  static getLanguageConfig(language: string): LanguageConfig | undefined {
    return LANGUAGE_CONFIGS[language];
  }

  // Special puzzle configurations
  static getPuzzleConfig(puzzleName: string): {
    timeout: number;
    preprocessCode: boolean;
    specialRules: string[];
  } {
    const configs: Record<string, any> = {
      "the_pebble": {
        timeout: 5,
        preprocessCode: false,
        specialRules: ["extended_timeout"]
      },
      "merger": {
        timeout: 1,
        preprocessCode: true,
        specialRules: ["remove_operators"]
      },
      "gargantuan": {
        timeout: 1,
        preprocessCode: true,
        specialRules: ["remove_bigint"]
      }
    };

    return configs[puzzleName] || {
      timeout: this.DEFAULT_TIMEOUT,
      preprocessCode: false,
      specialRules: []
    };
  }
}
