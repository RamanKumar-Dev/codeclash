import { existsSync, readdirSync } from "fs";
import { readFile } from "fs/promises";

export interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  eloRange: [number, number];
  testCases: TestCase[];
  hiddenTestCases: TestCase[];
  timeLimit?: number;
  memoryLimit?: number;
  languages: string[];
  tags: string[];
  benchmarks?: LanguageBenchmark[];
}

export interface TestCase {
  input: string;
  expected: string;
  isHidden?: boolean;
}

export interface LanguageBenchmark {
  language: string;
  avgTimeMs: number;
  avgMemoryMb: number;
}

export interface PuzzleRegion {
  id: string;
  name: string;
  description: string;
  puzzles: Puzzle[];
  eloRange: [number, number];
}

export class PuzzleService {
  private static puzzleCache = new Map<string, Puzzle>();
  private static regionCache = new Map<string, PuzzleRegion>();

  static async getPuzzleById(puzzleId: string): Promise<Puzzle | null> {
    // Check cache first
    if (this.puzzleCache.has(puzzleId)) {
      return this.puzzleCache.get(puzzleId)!;
    }

    try {
      // Load puzzle from file system
      const puzzle = await this.loadPuzzleFromFile(puzzleId);
      if (puzzle) {
        this.puzzleCache.set(puzzleId, puzzle);
      }
      return puzzle;
    } catch (error) {
      console.error(`Error loading puzzle ${puzzleId}:`, error);
      return null;
    }
  }

  static async getPuzzlesByDifficulty(difficulty: number): Promise<Puzzle[]> {
    const puzzles: Puzzle[] = [];
    
    // This would scan all puzzle directories and filter by difficulty
    // For now, return cached puzzles that match
    for (const puzzle of this.puzzleCache.values()) {
      if (puzzle.difficulty === difficulty) {
        puzzles.push(puzzle);
      }
    }
    
    return puzzles;
  }

  static async getPuzzlesByElo(elo: number): Promise<Puzzle[]> {
    const puzzles: Puzzle[] = [];
    
    for (const puzzle of this.puzzleCache.values()) {
      if (elo >= puzzle.eloRange[0] && elo <= puzzle.eloRange[1]) {
        puzzles.push(puzzle);
      }
    }
    
    return puzzles;
  }

  static async getRandomPuzzle(elo: number, excludeIds?: string[]): Promise<Puzzle | null> {
    const eligiblePuzzles = await this.getPuzzlesByElo(elo);
    
    const filtered = eligiblePuzzles.filter(puzzle => 
      !excludeIds?.includes(puzzle.id)
    );
    
    if (filtered.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex];
  }

  static async getRegionById(regionId: string): Promise<PuzzleRegion | null> {
    if (this.regionCache.has(regionId)) {
      return this.regionCache.get(regionId)!;
    }

    try {
      const region = await this.loadRegionFromFile(regionId);
      if (region) {
        this.regionCache.set(regionId, region);
      }
      return region;
    } catch (error) {
      console.error(`Error loading region ${regionId}:`, error);
      return null;
    }
  }

  private static async loadPuzzleFromFile(puzzleId: string): Promise<Puzzle | null> {
    // This would load puzzle from the file system similar to Lootcode structure
    const puzzlePath = `./src/puzzles/${puzzleId}`;
    
    if (!existsSync(puzzlePath)) {
      return null;
    }

    try {
      // Load problem description
      const description = await readFile(`${puzzlePath}/problem.md`, "utf-8");
      
      // Load test cases
      const testCases = await this.loadTestCases(`${puzzlePath}/input`, `${puzzlePath}/output`);
      
      // Load metadata (if exists)
      let metadata: Partial<Puzzle> = {};
      if (existsSync(`${puzzlePath}/metadata.json`)) {
        const metadataContent = await readFile(`${puzzlePath}/metadata.json`, "utf-8");
        metadata = JSON.parse(metadataContent);
      }

      return {
        id: puzzleId,
        title: metadata.title || puzzleId,
        description,
        difficulty: metadata.difficulty || 3,
        eloRange: metadata.eloRange || [1000, 1200],
        testCases: testCases.visible,
        hiddenTestCases: testCases.hidden,
        timeLimit: metadata.timeLimit || 1,
        memoryLimit: metadata.memoryLimit || 256,
        languages: metadata.languages || ["python", "java", "cpp", "c"],
        tags: metadata.tags || [],
        benchmarks: metadata.benchmarks,
      };
    } catch (error) {
      console.error(`Error loading puzzle files for ${puzzleId}:`, error);
      return null;
    }
  }

  private static async loadTestCases(inputDir: string, outputDir: string): Promise<{
    visible: TestCase[];
    hidden: TestCase[];
  }> {
    const visible: TestCase[] = [];
    const hidden: TestCase[] = [];

    if (!existsSync(inputDir) || !existsSync(outputDir)) {
      return { visible, hidden };
    }

    const inputFiles = readdirSync(inputDir).filter(file => file.endsWith('.in'));
    
    for (let i = 0; i < inputFiles.length; i++) {
      const inputFile = inputFiles[i];
      const outputFile = inputFile.replace('.in', '.out');
      
      try {
        const inputContent = await readFile(`${inputDir}/${inputFile}`, "utf-8");
        const expectedContent = await readFile(`${outputDir}/${outputFile}`, "utf-8");
        
        const testCase: TestCase = {
          input: inputContent,
          expected: expectedContent,
          isHidden: i >= 5, // First 5 are visible, rest are hidden
        };
        
        if (testCase.isHidden) {
          hidden.push(testCase);
        } else {
          visible.push(testCase);
        }
      } catch (error) {
        console.error(`Error loading test case ${inputFile}:`, error);
      }
    }

    return { visible, hidden };
  }

  private static async loadRegionFromFile(regionId: string): Promise<PuzzleRegion | null> {
    // Similar to Lootcode's region structure
    const regionPath = `./src/puzzles/regions/${regionId}`;
    
    if (!existsSync(regionPath)) {
      return null;
    }

    try {
      // Load region metadata
      const metadataContent = await readFile(`${regionPath}/metadata.json`, "utf-8");
      const metadata = JSON.parse(metadataContent);
      
      // Load puzzles in this region
      const puzzleDirs = readdirSync(regionPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      const puzzles: Puzzle[] = [];
      for (const puzzleDir of puzzleDirs) {
        const puzzle = await this.getPuzzleById(puzzleDir);
        if (puzzle) {
          puzzles.push(puzzle);
        }
      }

      return {
        id: regionId,
        name: metadata.name || regionId,
        description: metadata.description || "",
        puzzles,
        eloRange: metadata.eloRange || [1000, 1200],
      };
    } catch (error) {
      console.error(`Error loading region ${regionId}:`, error);
      return null;
    }
  }

  static clearCache(): void {
    this.puzzleCache.clear();
    this.regionCache.clear();
  }

  static preloadPuzzles(puzzleIds: string[]): void {
    // Preload commonly used puzzles
    puzzleIds.forEach(async (id) => {
      await this.getPuzzleById(id);
    });
  }
}
