import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedProblems = [
  // ─── EASY ─────────────────────────────────────────────────────────────────
  {
    title: 'Two Sum',
    description: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers that add up to `target`.\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice.',
    difficulty: 'easy',
    timeLimitMs: 300000,
    memoryLimitMb: 256,
    p50RuntimeMs: 80,
    tags: ['arrays', 'hashing'],
    examples: [
      { input: '[2,7,11,15], 9', output: '[0,1]' },
      { input: '[3,2,4], 6', output: '[1,2]' },
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
    description: 'Given a string `s`, return `true` if it is a palindrome, or `false` otherwise.\n\nConsider only alphanumeric characters and ignore case.',
    difficulty: 'easy',
    timeLimitMs: 180000,
    memoryLimitMb: 256,
    p50RuntimeMs: 50,
    tags: ['strings', 'two-pointers'],
    examples: [
      { input: '"A man, a plan, a canal: Panama"', output: 'true' },
      { input: '"race a car"', output: 'false' },
    ],
    testCases: [
      { input: '"A man, a plan, a canal: Panama"', expectedOutput: 'true', isHidden: false },
      { input: '"race a car"', expectedOutput: 'false', isHidden: false },
      { input: '" "', expectedOutput: 'true', isHidden: false },
      { input: '"Madam"', expectedOutput: 'true', isHidden: true },
      { input: '"No lemon, no melon"', expectedOutput: 'true', isHidden: true },
      { input: '"0P"', expectedOutput: 'false', isHidden: true },
    ],
  },
  {
    title: 'FizzBuzz',
    description: 'Given an integer `n`, return an array of strings from 1 to n where:\n- Multiples of 3 → "Fizz"\n- Multiples of 5 → "Buzz"\n- Multiples of both → "FizzBuzz"\n- Otherwise → the number as a string',
    difficulty: 'easy',
    timeLimitMs: 120000,
    memoryLimitMb: 256,
    p50RuntimeMs: 30,
    tags: ['arrays', 'iteration'],
    examples: [
      { input: '3', output: '["1","2","Fizz"]' },
      { input: '5', output: '["1","2","Fizz","4","Buzz"]' },
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
    title: 'Reverse String',
    description: 'Write a function that reverses a string. The input is given as an array of characters `s`.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.\n\nReturn the reversed array.',
    difficulty: 'easy',
    timeLimitMs: 120000,
    memoryLimitMb: 256,
    p50RuntimeMs: 40,
    tags: ['strings', 'two-pointers'],
    examples: [
      { input: '["h","e","l","l","o"]', output: '["o","l","l","e","h"]' },
      { input: '["H","a","n","n","a","h"]', output: '["h","a","n","n","a","H"]' },
    ],
    testCases: [
      { input: '["h","e","l","l","o"]', expectedOutput: '["o","l","l","e","h"]', isHidden: false },
      { input: '["H","a","n","n","a","h"]', expectedOutput: '["h","a","n","n","a","H"]', isHidden: false },
      { input: '["a"]', expectedOutput: '["a"]', isHidden: true },
      { input: '["a","b"]', expectedOutput: '["b","a"]', isHidden: true },
    ],
  },
  {
    title: 'Count Vowels',
    description: 'Given a string `s`, return the number of vowel letters (a, e, i, o, u) in it. Both uppercase and lowercase vowels should be counted.',
    difficulty: 'easy',
    timeLimitMs: 90000,
    memoryLimitMb: 256,
    p50RuntimeMs: 20,
    tags: ['strings'],
    examples: [
      { input: '"leetcode"', output: '3' },
      { input: '"aeiou"', output: '5' },
    ],
    testCases: [
      { input: '"leetcode"', expectedOutput: '3', isHidden: false },
      { input: '"aeiou"', expectedOutput: '5', isHidden: false },
      { input: '"AEIOU"', expectedOutput: '5', isHidden: false },
      { input: '"rhythm"', expectedOutput: '0', isHidden: true },
      { input: '"Hello World"', expectedOutput: '3', isHidden: true },
      { input: '""', expectedOutput: '0', isHidden: true },
    ],
  },
  {
    title: 'Maximum in Array',
    description: 'Given an array of integers `nums`, return the maximum element.\n\nDo not use built-in max functions.',
    difficulty: 'easy',
    timeLimitMs: 90000,
    memoryLimitMb: 256,
    p50RuntimeMs: 20,
    tags: ['arrays'],
    examples: [
      { input: '[3,2,1,5,6,4]', output: '6' },
      { input: '[1,2]', output: '2' },
    ],
    testCases: [
      { input: '[3,2,1,5,6,4]', expectedOutput: '6', isHidden: false },
      { input: '[1,2]', expectedOutput: '2', isHidden: false },
      { input: '[-1,-2,-3]', expectedOutput: '-1', isHidden: true },
      { input: '[0,0,0]', expectedOutput: '0', isHidden: true },
      { input: '[1000000]', expectedOutput: '1000000', isHidden: true },
    ],
  },

  // ─── MEDIUM ───────────────────────────────────────────────────────────────
  {
    title: 'Valid Parentheses',
    description: "Given a string `s` containing just `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.\n\nAn input string is valid if:\n- Open brackets are closed by the same type of bracket\n- Open brackets are closed in the correct order",
    difficulty: 'medium',
    timeLimitMs: 180000,
    memoryLimitMb: 256,
    p50RuntimeMs: 60,
    tags: ['stack', 'strings'],
    examples: [
      { input: '"()"', output: 'true' },
      { input: '"()[]{}"', output: 'true' },
      { input: '"(]"', output: 'false' },
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
  {
    title: 'Fibonacci Number',
    description: 'F(0) = 0, F(1) = 1, F(n) = F(n-1) + F(n-2) for n > 1.\n\nGiven n, calculate F(n).',
    difficulty: 'medium',
    timeLimitMs: 240000,
    memoryLimitMb: 256,
    p50RuntimeMs: 100,
    tags: ['recursion', 'dynamic-programming'],
    examples: [
      { input: '2', output: '1' },
      { input: '3', output: '2' },
      { input: '4', output: '3' },
    ],
    testCases: [
      { input: '2', expectedOutput: '1', isHidden: false },
      { input: '3', expectedOutput: '2', isHidden: false },
      { input: '0', expectedOutput: '0', isHidden: true },
      { input: '1', expectedOutput: '1', isHidden: true },
      { input: '10', expectedOutput: '55', isHidden: true },
      { input: '30', expectedOutput: '832040', isHidden: true },
    ],
  },
  {
    title: 'Binary Search',
    description: 'Given a sorted array of `n` integers and a `target`, write a function to search for `target`. If it exists, return its index; otherwise return `-1`.\n\nYou must write an algorithm with O(log n) runtime complexity.',
    difficulty: 'medium',
    timeLimitMs: 180000,
    memoryLimitMb: 256,
    p50RuntimeMs: 40,
    tags: ['binary-search', 'arrays'],
    examples: [
      { input: '[-1,0,3,5,9,12], 9', output: '4' },
      { input: '[-1,0,3,5,9,12], 2', output: '-1' },
    ],
    testCases: [
      { input: '[-1,0,3,5,9,12], 9', expectedOutput: '4', isHidden: false },
      { input: '[-1,0,3,5,9,12], 2', expectedOutput: '-1', isHidden: false },
      { input: '[1], 1', expectedOutput: '0', isHidden: true },
      { input: '[1,2,3,4,5], 1', expectedOutput: '0', isHidden: true },
      { input: '[2,5], 5', expectedOutput: '1', isHidden: true },
    ],
  },
  {
    title: 'Valid Anagram',
    description: 'Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.\n\nAn anagram uses all the original letters exactly once.',
    difficulty: 'medium',
    timeLimitMs: 180000,
    memoryLimitMb: 256,
    p50RuntimeMs: 60,
    tags: ['strings', 'hashing'],
    examples: [
      { input: '"anagram", "nagaram"', output: 'true' },
      { input: '"rat", "car"', output: 'false' },
    ],
    testCases: [
      { input: '"anagram", "nagaram"', expectedOutput: 'true', isHidden: false },
      { input: '"rat", "car"', expectedOutput: 'false', isHidden: false },
      { input: '"a", "a"', expectedOutput: 'true', isHidden: true },
      { input: '"ab", "a"', expectedOutput: 'false', isHidden: true },
      { input: '"listen", "silent"', expectedOutput: 'true', isHidden: true },
    ],
  },
  {
    title: 'Merge Sorted Arrays',
    description: 'You are given two integer arrays `nums1` and `nums2`, sorted in non-decreasing order, and two integers `m` and `n`, representing the number of elements in `nums1` and `nums2` respectively.\n\nMerge `nums2` into `nums1` in-place as one sorted array. Return the merged array.',
    difficulty: 'medium',
    timeLimitMs: 180000,
    memoryLimitMb: 256,
    p50RuntimeMs: 50,
    tags: ['arrays', 'two-pointers', 'sorting'],
    examples: [
      { input: '[1,2,3,0,0,0], 3, [2,5,6], 3', output: '[1,2,2,3,5,6]' },
      { input: '[1], 1, [], 0', output: '[1]' },
    ],
    testCases: [
      { input: '[1,2,3,0,0,0], 3, [2,5,6], 3', expectedOutput: '[1,2,2,3,5,6]', isHidden: false },
      { input: '[1], 1, [], 0', expectedOutput: '[1]', isHidden: false },
      { input: '[0], 0, [1], 1', expectedOutput: '[1]', isHidden: true },
      { input: '[2,0], 1, [1], 1', expectedOutput: '[1,2]', isHidden: true },
    ],
  },

  // ─── HARD ─────────────────────────────────────────────────────────────────
  {
    title: 'Longest Substring Without Repeating Characters',
    description: 'Given a string `s`, find the length of the longest substring without repeating characters.',
    difficulty: 'hard',
    timeLimitMs: 300000,
    memoryLimitMb: 256,
    p50RuntimeMs: 120,
    tags: ['strings', 'sliding-window', 'hashing'],
    examples: [
      { input: '"abcabcbb"', output: '3' },
      { input: '"bbbbb"', output: '1' },
      { input: '"pwwkew"', output: '3' },
    ],
    testCases: [
      { input: '"abcabcbb"', expectedOutput: '3', isHidden: false },
      { input: '"bbbbb"', expectedOutput: '1', isHidden: false },
      { input: '"pwwkew"', expectedOutput: '3', isHidden: false },
      { input: '""', expectedOutput: '0', isHidden: true },
      { input: '" "', expectedOutput: '1', isHidden: true },
      { input: '"dvdf"', expectedOutput: '3', isHidden: true },
    ],
  },
  {
    title: 'Maximum Subarray',
    description: 'Given an integer array `nums`, find the subarray with the largest sum and return its sum.\n\nSolve using Kadane\'s algorithm for O(n) time.',
    difficulty: 'hard',
    timeLimitMs: 300000,
    memoryLimitMb: 256,
    p50RuntimeMs: 80,
    tags: ['arrays', 'dynamic-programming', 'divide-and-conquer'],
    examples: [
      { input: '[-2,1,-3,4,-1,2,1,-5,4]', output: '6' },
      { input: '[1]', output: '1' },
    ],
    testCases: [
      { input: '[-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6', isHidden: false },
      { input: '[1]', expectedOutput: '1', isHidden: false },
      { input: '[5,4,-1,7,8]', expectedOutput: '23', isHidden: false },
      { input: '[-1]', expectedOutput: '-1', isHidden: true },
      { input: '[-2,-1]', expectedOutput: '-1', isHidden: true },
      { input: '[1,2,3,4,5]', expectedOutput: '15', isHidden: true },
    ],
  },
  {
    title: 'Jump Game',
    description: 'You are given an integer array `nums`. You are initially positioned at the first index, and each element represents your maximum jump length at that position.\n\nReturn `true` if you can reach the last index, or `false` otherwise.',
    difficulty: 'hard',
    timeLimitMs: 300000,
    memoryLimitMb: 256,
    p50RuntimeMs: 80,
    tags: ['arrays', 'greedy', 'dynamic-programming'],
    examples: [
      { input: '[2,3,1,1,4]', output: 'true' },
      { input: '[3,2,1,0,4]', output: 'false' },
    ],
    testCases: [
      { input: '[2,3,1,1,4]', expectedOutput: 'true', isHidden: false },
      { input: '[3,2,1,0,4]', expectedOutput: 'false', isHidden: false },
      { input: '[0]', expectedOutput: 'true', isHidden: true },
      { input: '[1,0,0]', expectedOutput: 'false', isHidden: true },
      { input: '[1,1,1,1]', expectedOutput: 'true', isHidden: true },
    ],
  },
  {
    title: 'Product of Array Except Self',
    description: 'Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all elements of `nums` except `nums[i]`.\n\nThe product of any prefix or suffix of `nums` is guaranteed to fit in a 32-bit integer.\n\nYou must write an algorithm that runs in O(n) time and without using the division operation.',
    difficulty: 'hard',
    timeLimitMs: 300000,
    memoryLimitMb: 256,
    p50RuntimeMs: 100,
    tags: ['arrays', 'prefix-sum'],
    examples: [
      { input: '[1,2,3,4]', output: '[24,12,8,6]' },
      { input: '[-1,1,0,-3,3]', output: '[0,0,9,0,0]' },
    ],
    testCases: [
      { input: '[1,2,3,4]', expectedOutput: '[24,12,8,6]', isHidden: false },
      { input: '[-1,1,0,-3,3]', expectedOutput: '[0,0,9,0,0]', isHidden: false },
      { input: '[2,3]', expectedOutput: '[3,2]', isHidden: true },
      { input: '[1,1,1,1]', expectedOutput: '[1,1,1,1]', isHidden: true },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding database with 15 problems...');

  // Clear existing data in dependency order
  try {
    await prisma.userAchievement.deleteMany();
    await prisma.submission.deleteMany();
    await prisma.battleDamage.deleteMany();
    await prisma.battleSpell.deleteMany();
    await prisma.match.deleteMany();
    await prisma.problem.deleteMany();
    await prisma.user.deleteMany();
    console.log('🗑️  Cleared existing data');
  } catch (e) {
    console.log('Note: Some tables may not exist yet (run migrate first)');
  }

  // Create problems
  for (const problem of seedProblems) {
    await prisma.problem.create({ data: { ...problem, tags: JSON.stringify(problem.tags), examples: JSON.stringify(problem.examples), testCases: JSON.stringify(problem.testCases) } as any });
  }
  console.log(`✅ Created ${seedProblems.length} problems`);

  // Create sample users (password = 'password')
  const sampleUsers = [
    { username: 'Alice',   email: 'alice@example.com',   passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1520, wins: 28, losses: 6,  winStreak: 3 },
    { username: 'Bob',     email: 'bob@example.com',     passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1460, wins: 22, losses: 9,  winStreak: 1 },
    { username: 'Charlie', email: 'charlie@example.com', passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1410, wins: 18, losses: 11, winStreak: 0 },
    { username: 'Diana',   email: 'diana@example.com',   passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1360, wins: 15, losses: 13, winStreak: 2 },
    { username: 'Eve',     email: 'eve@example.com',     passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1310, wins: 12, losses: 16, winStreak: 0 },
    { username: 'Frank',   email: 'frank@example.com',   passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1250, wins: 8,  losses: 20, winStreak: 0 },
    { username: 'Grace',   email: 'grace@example.com',   passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1190, wins: 5,  losses: 18, winStreak: 0 },
    { username: 'dev',     email: 'dev@test.com',        passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', elo: 1000, wins: 0,  losses: 0,   winStreak: 0 },
  ];

  for (const user of sampleUsers) {
    await prisma.user.create({ data: { ...user, hp: 500, maxHp: 500, spellsCast: 0 } as any });
  }
  console.log(`✅ Created ${sampleUsers.length} sample users (password: "password")`);
  console.log('   🔑 Test account: dev@test.com / password');

  console.log('\n🎉 Database seeded successfully!');
  console.log(`   ${seedProblems.length} problems (6 easy, 5 medium, 4 hard)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
