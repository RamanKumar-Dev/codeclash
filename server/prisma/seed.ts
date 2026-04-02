import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedProblems = [
  {
    title: 'Two Sum',
    description: 'Given an array of integers and a target, return indices of two numbers that add up to the target.\n\nYou may assume each input has exactly one solution, and you may not use the same element twice.',
    difficulty: 'easy',
    timeLimitMs: 300000,
    memoryLimitMb: 256,
    tags: ['arrays', 'hashing', 'two-pointers'],
    examples: [
      { input: '[2,7,11,15], 9', output: '[0,1]' },
      { input: '[3,2,4], 6', output: '[1,2]' },
      { input: '[3,3], 6', output: '[0,1]' }
    ],
    testCases: [
      { input: '[2,7,11,15], 9', expectedOutput: '[0,1]', isHidden: false },
      { input: '[3,2,4], 6', expectedOutput: '[1,2]', isHidden: false },
      { input: '[3,3], 6', expectedOutput: '[0,1]', isHidden: false },
      { input: '[1,5,3,7,9,2], 11', expectedOutput: '[0,4]', isHidden: true },
      { input: '[0,4,3,0], 0', expectedOutput: '[0,3]', isHidden: true },
      { input: '[-1,-2,-3,-4,-5], -8', expectedOutput: '[2,4]', isHidden: true },
    ],
  },
  {
    title: 'Valid Palindrome',
    description: 'Given a string s, determine if it is a palindrome considering only alphanumeric characters and ignoring case.',
    difficulty: 'easy',
    timeLimitMs: 180000,
    memoryLimitMb: 256,
    tags: ['strings', 'two-pointers'],
    examples: [
      { input: '"A man, a plan, a canal: Panama"', output: 'true' },
      { input: '"race a car"', output: 'false' },
      { input: '" "', output: 'true' }
    ],
    testCases: [
      { input: '"A man, a plan, a canal: Panama"', expectedOutput: 'true', isHidden: false },
      { input: '"race a car"', expectedOutput: 'false', isHidden: false },
      { input: '" "', expectedOutput: 'true', isHidden: false },
      { input: '"Madam"', expectedOutput: 'true', isHidden: true },
      { input: '"No lemon, no melon"', expectedOutput: 'true', isHidden: true },
    ],
  },
  {
    title: 'FizzBuzz',
    description: 'Given an integer n, return an array of strings where multiples of 3 are "Fizz", multiples of 5 are "Buzz", multiples of both are "FizzBuzz", and all others are the number as a string.',
    difficulty: 'easy',
    timeLimitMs: 120000,
    memoryLimitMb: 256,
    tags: ['arrays', 'iteration'],
    examples: [
      { input: '3', output: '["1","2","Fizz"]' },
      { input: '5', output: '["1","2","Fizz","4","Buzz"]' },
      { input: '15', output: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]' }
    ],
    testCases: [
      { input: '3', expectedOutput: '["1","2","Fizz"]', isHidden: false },
      { input: '5', expectedOutput: '["1","2","Fizz","4","Buzz"]', isHidden: false },
      { input: '15', expectedOutput: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]', isHidden: false },
      { input: '1', expectedOutput: '["1"]', isHidden: true },
      { input: '0', expectedOutput: '[]', isHidden: true },
    ],
  },
  {
    title: 'Fibonacci Number',
    description: 'F(0) = 0, F(1) = 1, F(n) = F(n-1) + F(n-2) for n > 1. Given n, calculate F(n).',
    difficulty: 'medium',
    timeLimitMs: 240000,
    memoryLimitMb: 256,
    tags: ['recursion', 'dynamic-programming'],
    examples: [
      { input: '2', output: '1' },
      { input: '3', output: '2' },
      { input: '4', output: '3' }
    ],
    testCases: [
      { input: '2', expectedOutput: '1', isHidden: false },
      { input: '3', expectedOutput: '2', isHidden: false },
      { input: '4', expectedOutput: '3', isHidden: false },
      { input: '0', expectedOutput: '0', isHidden: true },
      { input: '10', expectedOutput: '55', isHidden: true },
      { input: '30', expectedOutput: '832040', isHidden: true },
    ],
  },
  {
    title: 'Valid Parentheses',
    description: "Given a string s containing just '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Open brackets must be closed in the correct order.",
    difficulty: 'medium',
    timeLimitMs: 180000,
    memoryLimitMb: 256,
    tags: ['stack', 'strings'],
    examples: [
      { input: '"()"', output: 'true' },
      { input: '"()[]{}"', output: 'true' },
      { input: '"(]"', output: 'false' }
    ],
    testCases: [
      { input: '"()"', expectedOutput: 'true', isHidden: false },
      { input: '"()[]{}"', expectedOutput: 'true', isHidden: false },
      { input: '"(]"', expectedOutput: 'false', isHidden: false },
      { input: '"([{}])"', expectedOutput: 'true', isHidden: true },
      { input: '"([)]"', expectedOutput: 'false', isHidden: true },
      { input: '"]"', expectedOutput: 'false', isHidden: true },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data in dependency order
  await prisma.submission.deleteMany();
  await prisma.battleDamage.deleteMany();
  await prisma.battleSpell.deleteMany();
  await prisma.match.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Create problems
  for (const problem of seedProblems) {
    await prisma.problem.create({ data: problem });
  }
  console.log(`✅ Created ${seedProblems.length} problems with test cases`);

  // Create sample users (password = 'password')
  const sampleUsers = [
    { username: 'Alice', email: 'alice@example.com', passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1500, wins: 25, losses: 5, hp: 500, maxHp: 500 },
    { username: 'Bob',   email: 'bob@example.com',   passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1450, wins: 20, losses: 8, hp: 500, maxHp: 500 },
    { username: 'Charlie', email: 'charlie@example.com', passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1400, wins: 18, losses: 10, hp: 500, maxHp: 500 },
    { username: 'Diana', email: 'diana@example.com', passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1350, wins: 15, losses: 12, hp: 500, maxHp: 500 },
    { username: 'Eve',   email: 'eve@example.com',   passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1300, wins: 12, losses: 15, hp: 500, maxHp: 500 },
  ];

  for (const user of sampleUsers) {
    await prisma.user.create({ data: user });
  }
  console.log(`✅ Created ${sampleUsers.length} sample users (password: "password")`);

  console.log('\n🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
