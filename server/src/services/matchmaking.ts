import { Server, Socket } from 'socket.io';
import { createClient, RedisClientType } from 'redis';
import { 
  User, 
  Battle, 
  Puzzle, 
  BattleState, 
  QueueJoinEvent, 
  BattleSubmitEvent, 
  BattleForfeitEvent,
  MatchFoundEvent,
  BattleDamageEvent,
  BattleEndEvent
} from '@code-clash/shared-types/mvp-types';

export class MatchmakingService {
  private io: Server;
  private redis: RedisClientType;
  private queue: string[] = []; // In-memory queue for MVP

  constructor(io: Server, redis: RedisClientType) {
    this.io = io;
    this.redis = redis;
  }

  // Add user to queue
  async addToQueue(userId: string): Promise<void> {
    // Check if user is already in queue
    if (this.queue.includes(userId)) {
      return;
    }

    this.queue.push(userId);
    console.log(`User ${userId} joined queue. Queue size: ${this.queue.length}`);

    // Try to find match
    await this.tryMatchmaking();
  }

  // Remove user from queue
  async removeFromQueue(userId: string): Promise<void> {
    const index = this.queue.indexOf(userId);
    if (index > -1) {
      this.queue.splice(index, 1);
      console.log(`User ${userId} left queue. Queue size: ${this.queue.length}`);
    }
  }

  // Try to find matches
  private async tryMatchmaking(): Promise<void> {
    while (this.queue.length >= 2) {
      const player1Id = this.queue.shift()!;
      const player2Id = this.queue.shift()!;

      await this.createMatch(player1Id, player2Id);
    }
  }

  // Create a match between two players
  private async createMatch(player1Id: string, player2Id: string): Promise<void> {
    const roomId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get random puzzle from the 5 seeded puzzles
    const puzzles = await this.getSeededPuzzles();
    const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];

    // Create battle record in MongoDB (simplified for MVP)
    const battle: Battle = {
      id: Math.random().toString(36).substr(2, 9),
      roomId,
      player1Id,
      player2Id,
      puzzleId: puzzle.id,
      createdAt: new Date(),
    };

    // TODO: Save battle to MongoDB
    console.log('Created battle:', battle);

    // Initialize battle state in Redis
    const battleState: BattleState = {
      player1Id,
      player2Id,
      hp1: 300, // Starting HP
      hp2: 300,
      startTimestamp: Date.now(),
      status: 'WAITING',
      sub1Count: 0,
      sub2Count: 0,
    };

    await this.redis.setEx(`battle:${roomId}`, 2400, JSON.stringify(battleState)); // 40 minutes TTL

    // Get user info for opponent names
    const player1Name = await this.getUserName(player1Id);
    const player2Name = await this.getUserName(player2Id);

    // Move both sockets into room
    const player1Socket = await this.getUserSocket(player1Id);
    const player2Socket = await this.getUserSocket(player2Id);

    if (player1Socket) {
      player1Socket.join(roomId);
      player1Socket.emit('match:found', {
        roomId,
        opponentName: player2Name,
        puzzle,
        timeLimitSeconds: puzzle.timeLimitSeconds,
      } as MatchFoundEvent);
    }

    if (player2Socket) {
      player2Socket.join(roomId);
      player2Socket.emit('match:found', {
        roomId,
        opponentName: player1Name,
        puzzle,
        timeLimitSeconds: puzzle.timeLimitSeconds,
      } as MatchFoundEvent);
    }

    console.log(`Match found: ${player1Name} vs ${player2Name} in room ${roomId}`);
  }

  // Get seeded puzzles (hardcoded for MVP)
  private async getSeededPuzzles(): Promise<Puzzle[]> {
    return [
      {
        id: 'two-sum',
        title: 'Two Sum',
        description: 'Given an array of integers and a target, return indices of two numbers that add up to the target.',
        difficulty: 1,
        examples: [
          { input: '[2,7,11,15], 9', output: '[0,1]' },
          { input: '[3,2,4], 6', output: '[1,2]' }
        ],
        testCases: [
          { input: '[2,7,11,15], 9', expectedOutput: '[0,1]', isHidden: false },
          { input: '[3,2,4], 6', expectedOutput: '[1,2]', isHidden: false },
          { input: '[3,3], 6', expectedOutput: '[0,1]', isHidden: true },
          { input: '[1,2,3,4,5], 9', expectedOutput: '[3,4]', isHidden: true },
          { input: '[-1,-2,-3,-4,-5], -8', expectedOutput: '[2,4]', isHidden: true },
        ],
        timeLimitSeconds: 300,
        p50RuntimeMs: 1000,
      },
      {
        id: 'palindrome',
        title: 'Valid Palindrome',
        description: 'Given a string, determine if it is a palindrome, considering only alphanumeric characters.',
        difficulty: 1,
        examples: [
          { input: '"A man, a plan, a canal: Panama"', output: 'true' },
          { input: '"race a car"', output: 'false' }
        ],
        testCases: [
          { input: '"A man, a plan, a canal: Panama"', expectedOutput: 'true', isHidden: false },
          { input: '"race a car"', expectedOutput: 'false', isHidden: false },
          { input: '""', expectedOutput: 'true', isHidden: true },
          { input: '" "', expectedOutput: 'true', isHidden: true },
          { input: '"0P"', expectedOutput: 'false', isHidden: true },
        ],
        timeLimitSeconds: 180,
        p50RuntimeMs: 500,
      },
      {
        id: 'fizzbuzz',
        title: 'FizzBuzz',
        description: 'Return an array with numbers 1 to n, but for multiples of 3 return "Fizz", for multiples of 5 return "Buzz", and for multiples of both return "FizzBuzz".',
        difficulty: 1,
        examples: [
          { input: '3', output: '["1","2","Fizz"]' },
          { input: '5', output: '["1","2","Fizz","4","Buzz"]' }
        ],
        testCases: [
          { input: '3', expectedOutput: '["1","2","Fizz"]', isHidden: false },
          { input: '5', expectedOutput: '["1","2","Fizz","4","Buzz"]', isHidden: false },
          { input: '15', expectedOutput: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]', isHidden: true },
          { input: '1', expectedOutput: '["1"]', isHidden: true },
          { input: '0', expectedOutput: '[]', isHidden: true },
        ],
        timeLimitSeconds: 120,
        p50RuntimeMs: 300,
      },
      {
        id: 'fibonacci',
        title: 'Fibonacci Number',
        description: 'Return the nth Fibonacci number.',
        difficulty: 2,
        examples: [
          { input: '2', output: '1' },
          { input: '3', output: '2' }
        ],
        testCases: [
          { input: '2', expectedOutput: '1', isHidden: false },
          { input: '3', expectedOutput: '2', isHidden: false },
          { input: '10', expectedOutput: '55', isHidden: true },
          { input: '0', expectedOutput: '0', isHidden: true },
          { input: '20', expectedOutput: '6765', isHidden: true },
        ],
        timeLimitSeconds: 240,
        p50RuntimeMs: 800,
      },
      {
        id: 'valid-parentheses',
        title: 'Valid Parentheses',
        description: 'Given a string containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.',
        difficulty: 2,
        examples: [
          { input: '"()"', output: 'true' },
          { input: '"()[]{}"', output: 'true' }
        ],
        testCases: [
          { input: '"()"', expectedOutput: 'true', isHidden: false },
          { input: '"()[]{}"', expectedOutput: 'true', isHidden: false },
          { input: '"(]"', expectedOutput: 'false', isHidden: true },
          { input: '"([)]"', expectedOutput: 'false', isHidden: true },
          { input: '"{[]}"', expectedOutput: 'true', isHidden: true },
        ],
        timeLimitSeconds: 180,
        p50RuntimeMs: 600,
      }
    ];
  }

  // Mock user name lookup (MVP)
  private async getUserName(userId: string): Promise<string> {
    // TODO: Fetch from database
    return `User${userId.substr(0, 4)}`;
  }

  // Get user socket by ID
  private async getUserSocket(userId: string): Promise<Socket | null> {
    // TODO: Maintain socket-to-user mapping
    // For MVP, we'll return null (socket lookup will be handled in main socket handler)
    return null;
  }
}
