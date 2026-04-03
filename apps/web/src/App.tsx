import { useState, useEffect, useRef } from 'react'

interface Puzzle {
  id: string
  title: string
  description: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  timeLimit: number
  testCases: TestCase[]
}

interface TestCase {
  input: string
  expectedOutput: string
  isHidden: boolean
}

interface Player {
  id: string
  name: string
  health: number
  maxHealth: number
  submissions: number
  lastSubmissionTime?: number
  score: number
}

const puzzles: Puzzle[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    difficulty: 'Easy',
    timeLimit: 75,
    testCases: [
      { input: 'nums = [2,7,11,15], target = 9', expectedOutput: '[0,1]', isHidden: false },
      { input: 'nums = [3,2,4], target = 6', expectedOutput: '[1,2]', isHidden: false },
      { input: 'nums = [3,3], target = 6', expectedOutput: '[0,1]', isHidden: true }
    ]
  },
  {
    id: 'reverse-string',
    title: 'Reverse String',
    description: 'Write a function that reverses a string. The input string is given as an array of characters s.',
    difficulty: 'Easy',
    timeLimit: 60,
    testCases: [
      { input: 's = ["h","e","l","l","o"]', expectedOutput: '["o","l","l","e","h"]', isHidden: false },
      { input: 's = ["H"]', expectedOutput: '["H"]', isHidden: false },
      { input: 's = []', expectedOutput: '[]', isHidden: true }
    ]
  },
  {
    id: 'palindrome-number',
    title: 'Palindrome Number',
    description: 'Given an integer x, return true if x is a palindrome, and false otherwise.',
    difficulty: 'Easy',
    timeLimit: 90,
    testCases: [
      { input: 'x = 121', expectedOutput: 'true', isHidden: false },
      { input: 'x = -121', expectedOutput: 'false', isHidden: false },
      { input: 'x = 10', expectedOutput: 'false', isHidden: true },
      { input: 'x = -101', expectedOutput: 'false', isHidden: true }
    ]
  },
  {
    id: 'roman-to-integer',
    title: 'Roman to Integer',
    description: 'Given a roman numeral, convert it to an integer.',
    difficulty: 'Easy',
    timeLimit: 80,
    testCases: [
      { input: 's = "III"', expectedOutput: '3', isHidden: false },
      { input: 's = "IV"', expectedOutput: '4', isHidden: false },
      { input: 's = "IX"', expectedOutput: '9', isHidden: true },
      { input: 's = "LVIII"', expectedOutput: '58', isHidden: true }
    ]
  },
  {
    id: 'longest-common-prefix',
    title: 'Longest Common Prefix',
    description: 'Write a function to find the longest common prefix string amongst an array of strings.',
    difficulty: 'Easy',
    timeLimit: 85,
    testCases: [
      { input: 'strs = ["flower","flow","flight"]', expectedOutput: '"fl"', isHidden: false },
      { input: 'strs = ["dog","racecar","car"]', expectedOutput: '""', isHidden: false },
      { input: 'strs = [""]', expectedOutput: '""', isHidden: true },
      { input: 'strs = ["a"]', expectedOutput: '"a"', isHidden: true }
    ]
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.',
    difficulty: 'Easy',
    timeLimit: 70,
    testCases: [
      { input: 's = "()"', expectedOutput: 'true', isHidden: false },
      { input: 's = "()[]{}"', expectedOutput: 'true', isHidden: false },
      { input: 's = "(]"', expectedOutput: 'false', isHidden: true },
      { input: 's = "([)]"', expectedOutput: 'false', isHidden: true }
    ]
  },
  {
    id: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    description: 'You are given the heads of two sorted linked lists. Merge the two lists in a one sorted list.',
    difficulty: 'Medium',
    timeLimit: 100,
    testCases: [
      { input: 'list1 = [1,2,4], list2 = [1,3,4]', expectedOutput: '[1,1,2,3,4,4]', isHidden: false },
      { input: 'list1 = [], list2 = []', expectedOutput: '[]', isHidden: false },
      { input: 'list1 = [], list2 = [0]', expectedOutput: '[0]', isHidden: true }
    ]
  },
  {
    id: 'search-insert-position',
    title: 'Search Insert Position',
    description: 'Given a sorted array of distinct integers and a target value, return the index if the target is found.',
    difficulty: 'Easy',
    timeLimit: 65,
    testCases: [
      { input: 'nums = [1,3,5,6], target = 5', expectedOutput: '2', isHidden: false },
      { input: 'nums = [1,3,5,6], target = 2', expectedOutput: '1', isHidden: false },
      { input: 'nums = [1,3,5,6], target = 7', expectedOutput: '4', isHidden: true }
    ]
  },
  {
    id: 'add-binary',
    title: 'Add Binary',
    description: 'Given two binary strings a and b, return their sum as a binary string.',
    difficulty: 'Easy',
    timeLimit: 80,
    testCases: [
      { input: 'a = "11", b = "1"', expectedOutput: '"100"', isHidden: false },
      { input: 'a = "1010", b = "1011"', expectedOutput: '"10101"', isHidden: false },
      { input: 'a = "0", b = "0"', expectedOutput: '"0"', isHidden: true }
    ]
  },
  {
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    description: 'You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps.',
    difficulty: 'Easy',
    timeLimit: 70,
    testCases: [
      { input: 'n = 2', expectedOutput: '2', isHidden: false },
      { input: 'n = 3', expectedOutput: '3', isHidden: false },
      { input: 'n = 1', expectedOutput: '1', isHidden: true },
      { input: 'n = 4', expectedOutput: '5', isHidden: true }
    ]
  },
  {
    id: 'maximum-subarray',
    title: 'Maximum Subarray',
    description: 'Given an integer array nums, find the subarray with the largest sum and return its sum.',
    difficulty: 'Medium',
    timeLimit: 120,
    testCases: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6', isHidden: false },
      { input: 'nums = [1]', expectedOutput: '1', isHidden: false },
      { input: 'nums = [5,4,-1,7,8]', expectedOutput: '23', isHidden: true }
    ]
  },
  {
    id: 'fizz-buzz',
    title: 'Fizz Buzz',
    description: 'Given an integer n, return a string array answer where answer[i] == "FizzBuzz" if i is divisible by 3 and 5.',
    difficulty: 'Easy',
    timeLimit: 90,
    testCases: [
      { input: 'n = 3', expectedOutput: '["1","2","Fizz"]', isHidden: false },
      { input: 'n = 5', expectedOutput: '["1","2","Fizz","4","Buzz"]', isHidden: false },
      { input: 'n = 15', expectedOutput: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]', isHidden: true }
    ]
  },
  {
    id: 'contains-duplicate',
    title: 'Contains Duplicate',
    description: 'Given an integer array nums, return true if any value appears at least twice in the array.',
    difficulty: 'Easy',
    timeLimit: 75,
    testCases: [
      { input: 'nums = [1,2,3,1]', expectedOutput: 'true', isHidden: false },
      { input: 'nums = [1,2,3,4]', expectedOutput: 'false', isHidden: false },
      { input: 'nums = [1,1,1,3,3,4,3,2,4,2]', expectedOutput: 'true', isHidden: true }
    ]
  },
  {
    id: 'summary-ranges',
    title: 'Summary Ranges',
    description: 'You are given a sorted unique integer array nums. Return the smallest sorted list of ranges that cover all numbers.',
    difficulty: 'Medium',
    timeLimit: 110,
    testCases: [
      { input: 'nums = [0,1,2,4,5,7]', expectedOutput: '["0->2","4->5","7"]', isHidden: false },
      { input: 'nums = [0,2,3,4,6,8,9]', expectedOutput: '["0","2->4","6","8->9"]', isHidden: false },
      { input: 'nums = []', expectedOutput: '[]', isHidden: true }
    ]
  },
  {
    id: 'power-of-two',
    title: 'Power of Two',
    description: 'Given an integer n, return true if it is a power of two. Otherwise, return false.',
    difficulty: 'Easy',
    timeLimit: 60,
    testCases: [
      { input: 'n = 1', expectedOutput: 'true', isHidden: false },
      { input: 'n = 16', expectedOutput: 'true', isHidden: false },
      { input: 'n = 3', expectedOutput: 'false', isHidden: true },
      { input: 'n = 0', expectedOutput: 'false', isHidden: true }
    ]
  },
  {
    id: 'majority-element',
    title: 'Majority Element',
    description: 'Given an array nums of size n, return the majority element. The majority element is the element that appears more than ⌊n / 2⌋ times.',
    difficulty: 'Easy',
    timeLimit: 85,
    testCases: [
      { input: 'nums = [3,2,3]', expectedOutput: '3', isHidden: false },
      { input: 'nums = [2,2,1,1,1,2,2]', expectedOutput: '2', isHidden: false },
      { input: 'nums = [1]', expectedOutput: '1', isHidden: true }
    ]
  }
]

function App() {
  const [gameState, setGameState] = useState<'menu' | 'searching' | 'battle' | 'victory' | 'defeat' | 'draw'>('menu')
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle>(puzzles[0])
  const [player, setPlayer] = useState<Player>({ id: '1', name: 'You', health: 100, maxHealth: 100, submissions: 0, score: 0 })
  const [opponent, setOpponent] = useState<Player>({ id: '2', name: 'Opponent', health: 100, maxHealth: 100, submissions: 0, score: 0 })
  const [code, setCode] = useState(`// C++ Solution
#include <vector>
using namespace std;

class Solution {
public:
    int arraySum(vector<int>& nums) {
        // Write your solution here
        int sum = 0;
        for (int num : nums) {
            sum += num;
        }
        return sum;
    }
};`)
  const [language, setLanguage] = useState('cpp')
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [timeRemaining, setTimeRemaining] = useState(60)
  const [isRunning, setIsRunning] = useState(false)
  const [testResults, setTestResults] = useState<{passed: boolean, input: string, expected: string, actual: string, isHidden: boolean}[]>([])
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const battleStartTime = useRef<number>(Date.now())
  const timerInterval = useRef<NodeJS.Timeout>()

  const addLog = (message: string) => {
    setBattleLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const startBattle = () => {
    setGameState('searching')
    addLog('🔍 Searching for opponent...')
    
    // Simulate finding opponent
    setTimeout(() => {
      setGameState('battle')
      const randomPuzzle = puzzles[Math.floor(Math.random() * puzzles.length)]
      setCurrentPuzzle(randomPuzzle)
      setTimeRemaining(randomPuzzle.timeLimit)
      battleStartTime.current = Date.now()
      setCode(getLanguageTemplate(language, randomPuzzle))
      addLog(`⚔️ Battle started! Puzzle: ${randomPuzzle.title}`)
      addLog(`⏱️ Time limit: ${randomPuzzle.timeLimit} seconds`)
      startTimer()
    }, 2000)
  }

  const startTimer = () => {
    timerInterval.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - determine winner based on HP first, then score
          if (player.health > opponent.health) {
            setGameState('victory')
            addLog('⏰ Time\'s up! You win by HP advantage!')
          } else if (opponent.health > player.health) {
            setGameState('defeat')
            addLog('⏰ Time\'s up! You lose by HP disadvantage!')
          } else {
            // Equal HP - check scores
            if (player.score > opponent.score) {
              setGameState('victory')
              addLog('⏰ Time\'s up! You win by score advantage!')
            } else if (opponent.score > player.score) {
              setGameState('defeat')
              addLog('⏰ Time\'s up! You lose by score disadvantage!')
            } else {
              // Equal HP and equal scores - it's a draw
              endBattle('draw')
            }
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const runCode = async () => {
    if (isRunning) return
    
    setIsRunning(true)
    addLog('🔄 Running code...')
    
    // Show expected outputs in log
    addLog('📝 Expected outputs for sample tests:')
    currentPuzzle.testCases.filter(tc => !tc.isHidden).forEach((testCase, index) => {
      addLog(`  Test ${index + 1}: Input: ${testCase.input} → Output: ${testCase.expectedOutput}`)
    })
    
    // Simulate code execution
    setTimeout(() => {
      const results = simulateCodeExecution(code, currentPuzzle)
      setTestResults(results)
      
      const allPassed = results.every(r => r.passed)
      const submissionTime = Math.floor((Date.now() - battleStartTime.current) / 1000)
      
      // Show actual results
      addLog('🔍 Test Results:')
      results.filter(r => !r.isHidden).forEach((result, index) => {
        const status = result.passed ? '✅' : '❌'
        addLog(`  ${status} Test ${index + 1}: Got "${result.actual}" (Expected: "${result.expected}")`)
      })
      
      if (allPassed) {
        // Calculate damage based on speed and efficiency
        const baseDamage = 25
        const timeBonus = Math.max(0, Math.floor((currentPuzzle.timeLimit - submissionTime) / 10))
        const efficiencyBonus = Math.floor(Math.random() * 10) + 5
        const totalDamage = baseDamage + timeBonus + efficiencyBonus
        
        setOpponent(prev => {
          const newHealth = Math.max(0, prev.health - totalDamage)
          // Check if opponent's HP reached 0 - immediate victory
          if (newHealth <= 0) {
            setGameState('victory')
            addLog('🏆 Victory! You defeated your opponent!')
            if (timerInterval.current) {
              clearInterval(timerInterval.current)
            }
          }
          return { ...prev, health: newHealth, submissions: prev.submissions + 1 }
        })
        
        addLog(`✅ All tests passed! Dealt ${totalDamage} damage!`)
        addLog(`⚡ Speed bonus: +${timeBonus} | Efficiency bonus: +${efficiencyBonus}`)
        
        // Switch to new puzzle after solving
        setTimeout(() => {
          switchToNewPuzzle('player')
        }, 2000)
      } else {
        const failedTests = results.filter(r => !r.passed).length
        addLog(`❌ ${failedTests} test(s) failed! No damage dealt.`)
      }
      
      setPlayer(prev => ({ ...prev, submissions: prev.submissions + 1 }))
      setIsRunning(false)
    }, 1500)
  }

  const simulateCodeExecution = (userCode: string, puzzle: Puzzle) => {
    // Simple simulation - in real app this would execute code in sandbox
    const hasCode = userCode.length > 50
    const random = Math.random()
    
    return puzzle.testCases.map(testCase => ({
      passed: hasCode && random > 0.3, // 70% success rate if code exists
      input: testCase.input,
      expected: testCase.expectedOutput,
      actual: hasCode && random > 0.3 ? testCase.expectedOutput : 'Error',
      isHidden: testCase.isHidden
    }))
  }

  const simulateOpponentAttack = () => {
    const opponentTime = Math.floor(Math.random() * 30) + 10
    const damage = Math.floor(Math.random() * 20) + 15
    
    setTimeout(() => {
      // Simulate opponent solving the puzzle (30% chance)
      if (Math.random() > 0.7) {
        addLog(`🔥 Opponent solved the puzzle!`)
        setTimeout(() => {
          switchToNewPuzzle('opponent')
        }, 1000)
      } else {
        setPlayer(prev => {
          const newHealth = Math.max(0, prev.health - damage)
          // Check if player's HP reached 0 - immediate defeat
          if (newHealth <= 0) {
            setGameState('defeat')
            addLog('💀 Defeat! You were defeated!')
            if (timerInterval.current) {
              clearInterval(timerInterval.current)
            }
          }
          return { ...prev, health: newHealth }
        })
        
        setOpponent(prev => ({ ...prev, submissions: prev.submissions + 1 }))
        addLog(`🔥 Opponent submitted solution! You took ${damage} damage!`)
      }
    }, opponentTime * 1000)
  }

  const endBattle = (result: 'victory' | 'defeat' | 'time' | 'draw') => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
    
    if (result === 'victory') {
      setGameState('victory')
      addLog('🏆 Victory! You defeated your opponent!')
    } else if (result === 'defeat') {
      setGameState('defeat')
      addLog('💀 Defeat! You were defeated!')
    } else if (result === 'draw') {
      setGameState('draw')
      addLog('🤝 Draw! Both players have equal HP and scores!')
    } else {
      // Handle 'time' case - check who has more HP first, then score
      if (player.health > opponent.health) {
        setGameState('victory')
        addLog('⏰ Time\'s up! You win by HP advantage!')
      } else if (opponent.health > player.health) {
        setGameState('defeat')
        addLog('⏰ Time\'s up! You lose by HP disadvantage!')
      } else {
        // Equal HP - check scores
        if (player.score > opponent.score) {
          setGameState('victory')
          addLog('⏰ Time\'s up! You win by score advantage!')
        } else if (opponent.score > player.score) {
          setGameState('defeat')
          addLog('⏰ Time\'s up! You lose by score disadvantage!')
        } else {
          // Equal HP and equal scores - it's a draw
          setGameState('draw')
          addLog('🤝 Draw! Both players have equal HP and scores!')
        }
      }
    }
  }

  const switchToNewPuzzle = (winner: 'player' | 'opponent') => {
    // Get current puzzle index and move to next
    const currentIndex = puzzles.findIndex(p => p.id === currentPuzzle.id)
    const nextIndex = (currentIndex + 1) % puzzles.length
    const newPuzzle = puzzles[nextIndex]
    
    setCurrentPuzzle(newPuzzle)
    setTimeRemaining(newPuzzle.timeLimit)
    battleStartTime.current = Date.now()
    setCode(getLanguageTemplate(language, newPuzzle))
    setTestResults([])
    
    // Calculate difficulty-based bonus points
    const difficultyBonus = currentPuzzle.difficulty === 'Easy' ? 10 : 
                           currentPuzzle.difficulty === 'Medium' ? 20 : 30
    
    // Reduce loser's score and health, add bonus to winner
    if (winner === 'player') {
      setOpponent(prev => ({
        ...prev,
        score: Math.max(0, prev.score - 10),
        health: Math.max(0, prev.health - 15)
      }))
      setPlayer(prev => ({
        ...prev,
        score: prev.score + 20 + difficultyBonus
      }))
      addLog(`🎯 You solved it! New puzzle: ${newPuzzle.title}`)
      addLog(`💢 Opponent lost 10 points and 15 HP!`)
      addLog(`⭐ Difficulty bonus: +${difficultyBonus} points!`)
    } else {
      setPlayer(prev => ({
        ...prev,
        score: Math.max(0, prev.score - 10),
        health: Math.max(0, prev.health - 15)
      }))
      setOpponent(prev => ({
        ...prev,
        score: prev.score + 20 + difficultyBonus
      }))
      addLog(`💢 Opponent solved it! New puzzle: ${newPuzzle.title}`)
      addLog(`😔 You lost 10 points and 15 HP!`)
      addLog(`⭐ Opponent difficulty bonus: +${difficultyBonus} points!`)
    }
    
    addLog(`⏱️ Fresh timer: ${newPuzzle.timeLimit} seconds`)
  }

  const resetGame = () => {
    setGameState('menu')
    setPlayer({ id: '1', name: 'You', health: 100, maxHealth: 100, submissions: 0, score: 0 })
    setOpponent({ id: '2', name: 'Opponent', health: 100, maxHealth: 100, submissions: 0, score: 0 })
    setBattleLog([])
    setTestResults([])
    setTimeRemaining(60)
    setIsRunning(false)
    setCode(getLanguageTemplate(language, puzzles[0]))
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
    }
  }

  const getLanguageTemplate = (lang: string, puzzle: Puzzle) => {
    switch (lang) {
      case 'cpp':
        if (puzzle.id === 'two-sum') {
          return `// C++ Solution - Two Sum
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'reverse-string') {
          return `// C++ Solution - Reverse String
#include <vector>
using namespace std;

class Solution {
public:
    void reverseString(vector<char>& s) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'palindrome-number') {
          return `// C++ Solution - Palindrome Number
class Solution {
public:
    bool isPalindrome(int x) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'roman-to-integer') {
          return `// C++ Solution - Roman to Integer
#include <string>
using namespace std;

class Solution {
public:
    int romanToInt(string s) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'longest-common-prefix') {
          return `// C++ Solution - Longest Common Prefix
#include <vector>
#include <string>
using namespace std;

class Solution {
public:
    string longestCommonPrefix(vector<string>& strs) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'valid-parentheses') {
          return `// C++ Solution - Valid Parentheses
#include <stack>
#include <string>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'merge-two-sorted-lists') {
          return `// C++ Solution - Merge Two Sorted Lists
struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

class Solution {
public:
    ListNode* mergeTwoLists(ListNode* list1, ListNode* list2) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'search-insert-position') {
          return `// C++ Solution - Search Insert Position
#include <vector>
using namespace std;

class Solution {
public:
    int searchInsert(vector<int>& nums, int target) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'add-binary') {
          return `// C++ Solution - Add Binary
#include <string>
using namespace std;

class Solution {
public:
    string addBinary(string a, string b) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'climbing-stairs') {
          return `// C++ Solution - Climbing Stairs
class Solution {
public:
    int climbStairs(int n) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'maximum-subarray') {
          return `// C++ Solution - Maximum Subarray
#include <vector>
using namespace std;

class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'fizz-buzz') {
          return `// C++ Solution - Fizz Buzz
#include <vector>
#include <string>
using namespace std;

class Solution {
public:
    vector<string> fizzBuzz(int n) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'contains-duplicate') {
          return `// C++ Solution - Contains Duplicate
#include <vector>
#include <unordered_set>
using namespace std;

class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'summary-ranges') {
          return `// C++ Solution - Summary Ranges
#include <vector>
#include <string>
using namespace std;

class Solution {
public:
    vector<string> summaryRanges(vector<int>& nums) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'power-of-two') {
          return `// C++ Solution - Power of Two
class Solution {
public:
    bool isPowerOfTwo(int n) {
        // Write your solution here
        
    }
};`
        } else if (puzzle.id === 'majority-element') {
          return `// C++ Solution - Majority Element
#include <vector>
using namespace std;

class Solution {
public:
    int majorityElement(vector<int>& nums) {
        // Write your solution here
        
    }
};`
        }
        break
      case 'python':
        if (puzzle.id === 'two-sum') {
          return `# Python Solution - Two Sum
from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'reverse-string') {
          return `# Python Solution - Reverse String
from typing import List

class Solution:
    def reverseString(self, s: List[str]) -> None:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'palindrome-number') {
          return `# Python Solution - Palindrome Number
class Solution:
    def isPalindrome(self, x: int) -> bool:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'roman-to-integer') {
          return `# Python Solution - Roman to Integer
class Solution:
    def romanToInt(self, s: str) -> int:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'longest-common-prefix') {
          return `# Python Solution - Longest Common Prefix
from typing import List

class Solution:
    def longestCommonPrefix(self, strs: List[str]) -> str:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'valid-parentheses') {
          return `# Python Solution - Valid Parentheses
class Solution:
    def isValid(self, s: str) -> bool:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'merge-two-sorted-lists') {
          return `# Python Solution - Merge Two Sorted Lists
from typing import Optional

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class Solution:
    def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'search-insert-position') {
          return `# Python Solution - Search Insert Position
from typing import List

class Solution:
    def searchInsert(self, nums: List[int], target: int) -> int:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'add-binary') {
          return `# Python Solution - Add Binary
class Solution:
    def addBinary(self, a: str, b: str) -> str:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'climbing-stairs') {
          return `# Python Solution - Climbing Stairs
class Solution:
    def climbStairs(self, n: int) -> int:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'maximum-subarray') {
          return `# Python Solution - Maximum Subarray
from typing import List

class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'fizz-buzz') {
          return `# Python Solution - Fizz Buzz
from typing import List

class Solution:
    def fizzBuzz(self, n: int) -> List[str]:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'contains-duplicate') {
          return `# Python Solution - Contains Duplicate
from typing import List

class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'summary-ranges') {
          return `# Python Solution - Summary Ranges
from typing import List

class Solution:
    def summaryRanges(self, nums: List[int]) -> List[str]:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'power-of-two') {
          return `# Python Solution - Power of Two
class Solution:
    def isPowerOfTwo(self, n: int) -> bool:
        # Write your solution here
        
        `
        } else if (puzzle.id === 'majority-element') {
          return `# Python Solution - Majority Element
from typing import List

class Solution:
    def majorityElement(self, nums: List[int]) -> int:
        # Write your solution here
        
        `
        }
        break
      case 'javascript':
        if (puzzle.id === 'two-sum') {
          return `// JavaScript Solution - Two Sum
/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
class Solution {
    twoSum(nums, target) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'reverse-string') {
          return `// JavaScript Solution - Reverse String
/**
 * @param {character[]} s
 * @return {void} Do not return anything, modify s in-place instead.
 */
class Solution {
    reverseString(s) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'palindrome-number') {
          return `// JavaScript Solution - Palindrome Number
/**
 * @param {number} x
 * @return {boolean}
 */
class Solution {
    isPalindrome(x) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'roman-to-integer') {
          return `// JavaScript Solution - Roman to Integer
/**
 * @param {string} s
 * @return {number}
 */
class Solution {
    romanToInt(s) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'longest-common-prefix') {
          return `// JavaScript Solution - Longest Common Prefix
/**
 * @param {string[]} strs
 * @return {string}
 */
class Solution {
    longestCommonPrefix(strs) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'valid-parentheses') {
          return `// JavaScript Solution - Valid Parentheses
/**
 * @param {string} s
 * @return {boolean}
 */
class Solution {
    isValid(s) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'merge-two-sorted-lists') {
          return `// JavaScript Solution - Merge Two Sorted Lists
/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */
/**
 * @param {ListNode} list1
 * @param {ListNode} list2
 * @return {ListNode}
 */
class Solution {
    mergeTwoLists(list1, list2) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'search-insert-position') {
          return `// JavaScript Solution - Search Insert Position
/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
class Solution {
    searchInsert(nums, target) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'add-binary') {
          return `// JavaScript Solution - Add Binary
/**
 * @param {string} a
 * @param {string} b
 * @return {string}
 */
class Solution {
    addBinary(a, b) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'climbing-stairs') {
          return `// JavaScript Solution - Climbing Stairs
/**
 * @param {number} n
 * @return {number}
 */
class Solution {
    climbStairs(n) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'maximum-subarray') {
          return `// JavaScript Solution - Maximum Subarray
/**
 * @param {number[]} nums
 * @return {number}
 */
class Solution {
    maxSubArray(nums) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'fizz-buzz') {
          return `// JavaScript Solution - Fizz Buzz
/**
 * @param {number} n
 * @return {string[]}
 */
class Solution {
    fizzBuzz(n) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'contains-duplicate') {
          return `// JavaScript Solution - Contains Duplicate
/**
 * @param {number[]} nums
 * @return {boolean}
 */
class Solution {
    containsDuplicate(nums) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'summary-ranges') {
          return `// JavaScript Solution - Summary Ranges
/**
 * @param {number[]} nums
 * @return {string[]}
 */
class Solution {
    summaryRanges(nums) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'power-of-two') {
          return `// JavaScript Solution - Power of Two
/**
 * @param {number} n
 * @return {boolean}
 */
class Solution {
    isPowerOfTwo(n) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'majority-element') {
          return `// JavaScript Solution - Majority Element
/**
 * @param {number[]} nums
 * @return {number}
 */
class Solution {
    majorityElement(nums) {
        // Write your solution here
        
    }
}`
        }
        break
      case 'java':
        if (puzzle.id === 'two-sum') {
          return `// Java Solution - Two Sum
class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'reverse-string') {
          return `// Java Solution - Reverse String
class Solution {
    public void reverseString(char[] s) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'palindrome-number') {
          return `// Java Solution - Palindrome Number
class Solution {
    public boolean isPalindrome(int x) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'roman-to-integer') {
          return `// Java Solution - Roman to Integer
class Solution {
    public int romanToInt(String s) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'longest-common-prefix') {
          return `// Java Solution - Longest Common Prefix
class Solution {
    public String longestCommonPrefix(String[] strs) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'valid-parentheses') {
          return `// Java Solution - Valid Parentheses
class Solution {
    public boolean isValid(String s) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'merge-two-sorted-lists') {
          return `// Java Solution - Merge Two Sorted Lists
/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'search-insert-position') {
          return `// Java Solution - Search Insert Position
class Solution {
    public int searchInsert(int[] nums, int target) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'add-binary') {
          return `// Java Solution - Add Binary
class Solution {
    public String addBinary(String a, String b) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'climbing-stairs') {
          return `// Java Solution - Climbing Stairs
class Solution {
    public int climbStairs(int n) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'maximum-subarray') {
          return `// Java Solution - Maximum Subarray
class Solution {
    public int maxSubArray(int[] nums) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'fizz-buzz') {
          return `// Java Solution - Fizz Buzz
class Solution {
    public List<String> fizzBuzz(int n) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'contains-duplicate') {
          return `// Java Solution - Contains Duplicate
import java.util.*;

class Solution {
    public boolean containsDuplicate(int[] nums) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'summary-ranges') {
          return `// Java Solution - Summary Ranges
import java.util.*;

class Solution {
    public List<String> summaryRanges(int[] nums) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'power-of-two') {
          return `// Java Solution - Power of Two
class Solution {
    public boolean isPowerOfTwo(int n) {
        // Write your solution here
        
    }
}`
        } else if (puzzle.id === 'majority-element') {
          return `// Java Solution - Majority Element
class Solution {
    public int majorityElement(int[] nums) {
        // Write your solution here
        
    }
}`
        }
        break
    }
    return code
  }

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage)
    setCode(getLanguageTemplate(newLanguage, currentPuzzle))
  }

  const getHint = (puzzle: Puzzle) => {
    switch (puzzle.id) {
      case 'two-sum':
        return "💡 Hint: Use a hash map to store numbers and their indices. For each number, check if (target - current number) exists in the map."
      case 'reverse-string':
        return "💡 Hint: Use two pointers - one at the start and one at the end. Swap characters and move pointers towards the center."
      case 'palindrome-number':
        return "💡 Hint: Reverse the number and compare with original. Handle negative numbers and numbers ending with 0."
      case 'roman-to-integer':
        return "💡 Hint: Iterate through the string, adding values. Subtract when a smaller value precedes a larger one (like IV)."
      case 'longest-common-prefix':
        return "💡 Hint: Start with the first string as prefix. Compare each subsequent character and shrink prefix when mismatch found."
      case 'valid-parentheses':
        return "💡 Hint: Use a stack. Push opening brackets, pop when matching closing bracket found. Stack should be empty at end."
      case 'merge-two-sorted-lists':
        return "💡 Hint: Use two pointers to traverse both lists. Compare values and build new list. Handle remaining nodes."
      case 'search-insert-position':
        return "💡 Hint: Use binary search to find the position. Compare target with middle element and adjust search range."
      case 'add-binary':
        return "💡 Hint: Start from rightmost bits, add with carry. Use XOR for sum without carry, AND for carry calculation."
      case 'climbing-stairs':
        return "💡 Hint: This is Fibonacci sequence. Use DP: ways[n] = ways[n-1] + ways[n-2]. Base cases: ways[1]=1, ways[2]=2."
      case 'maximum-subarray':
        return "💡 Hint: Use Kadane's algorithm. Track current sum and max sum. Reset current sum to 0 when it becomes negative."
      case 'fizz-buzz':
        return "💡 Hint: Check divisibility in order: 15 first (3&5), then 3, then 5. Use modulo operator for divisibility check."
      case 'contains-duplicate':
        return "💡 Hint: Use a hash set to track seen numbers. If number already exists in set, return true."
      case 'summary-ranges':
        return "💡 Hint: Track start and end of ranges. When gap found, add range to result. Handle single numbers differently."
      case 'power-of-two':
        return "💡 Hint: A number is power of 2 if it has exactly one bit set. Use n > 0 and (n & (n-1)) == 0."
      case 'majority-element':
        return "💡 Hint: Use Boyer-Moore voting algorithm. Track candidate and count. Reset when count becomes 0."
      default:
        return "💡 Hint: Think about the problem step by step!"
    }
  }

  const getSolution = (puzzle: Puzzle, lang: string) => {
    switch (puzzle.id) {
      case 'array-sum':
        if (lang === 'cpp') {
          return `int sum = 0;
for (int num : nums) {
    sum += num;
}
return sum;`
        } else if (lang === 'python') {
          return `return sum(nums)`
        } else if (lang === 'javascript') {
          return `return nums.reduce((sum, num)Hint:
💡 Hint: Use a hash set to track seen numbers. If n => sum + num, 0);`
        } else if (lang === 'java') {
          return `int sum = 0;
for (int num : nums) {
    sum += num;
}
return sum;`
        }
        break
      case 'factorial':
        if (lang === 'cpp') {
          return `if (n <= 1) return 1;
return n * factorial(n - 1);`
        } else if (lang === 'python') {
          return `if n <= 1:
    return 1
return n * self.factorial(n - 1)`
        } else if (lang === 'javascript') {
          return `if (n <= 1) return 1;
return n * this.factorial(n - 1);`
        } else if (lang === 'java') {
          return `if (n <= 1) return 1;
return n * factorial(n - 1);`
        }
        break
      case 'palindrome':
        if (lang === 'cpp') {
          return `int left = 0, right = s.length() - 1;
while (left < right) {
    if (s[left] != s[right]) return false;
    left++;
    right--;
}
return true;`
        } else if (lang === 'python') {
          return `return s == s[::-1]`
        } else if (lang === 'javascript') {
          return `let left = 0, right = s.length - 1;
while (left < right) {
    if (s[left] !== s[right]) return false;
    left++;
    right--;
}
return true;`
        } else if (lang === 'java') {
          return `int left = 0, right = s.length() - 1;
while (left < right) {
    if (s.charAt(left) != s.charAt(right)) return false;
    left++;
    right--;
}
return true;`
        }
        break
    }
    return "// Solution not available"
  }

  const getSyntaxHighlighting = (code: string, lang: string) => {
    if (lang === 'cpp') {
      return code
        .replace(/\b(include|int|float|double|char|bool|void|return|if|else|for|while|using|namespace|std|cout|cin|endl|string|vector|array)\b/g, '<span class="text-purple-400">$1</span>')
        .replace(/\b(main)\b/g, '<span class="text-blue-400">$1</span>')
        .replace(/(#include)/g, '<span class="text-green-400">$1</span>')
        .replace(/(\/\/.*$)/gm, '<span class="text-gray-500">$1</span>')
    } else if (lang === 'python') {
      return code
        .replace(/\b(def|if|else|for|while|return|import|from|as|in|range|len|sum|print|class|__name__)\b/g, '<span class="text-purple-400">$1</span>')
        .replace(/(#.*$)/gm, '<span class="text-gray-500">$1</span>')
    } else if (lang === 'javascript') {
      return code
        .replace(/\b(function|const|let|var|if|else|for|while|return|console|log|reduce)\b/g, '<span class="text-purple-400">$1</span>')
        .replace(/(\/\/.*$)/gm, '<span class="text-gray-500">$1</span>')
    } else if (lang === 'java') {
      return code
        .replace(/\b(public|private|static|void|int|String|class|import|java\.util|if|else|for|while|return|System|out|println)\b/g, '<span class="text-purple-400">$1</span>')
        .replace(/(\/\/.*$)/gm, '<span class="text-gray-500">$1</span>')
    }
    return code
  }

  useEffect(() => {
    if (gameState === 'battle' && Math.random() > 0.7) {
      simulateOpponentAttack()
    }
  }, [player.submissions])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-gray-900 text-white p-4">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-purple-500 rounded-full filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500 rounded-full filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Code-Clash
          </h1>
          <p className="text-2xl text-gray-300">Arena of Algorithms</p>
        </div>
        
        {gameState === 'menu' && (
          <div className="text-center">
            <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-12 max-w-md mx-auto">
              <div className="text-6xl mb-4">⚔️</div>
              <h2 className="text-3xl font-bold mb-4">Ready to Battle?</h2>
              <p className="text-gray-300 mb-8">Challenge opponents in real-time coding combat!</p>
              <button 
                onClick={startBattle}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-8 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
              >
                Find Match
              </button>
            </div>
          </div>
        )}

        {gameState === 'searching' && (
          <div className="text-center">
            <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-12 max-w-md mx-auto">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Searching for Opponent...</h2>
              <p className="text-gray-400">Finding a worthy challenger</p>
            </div>
          </div>
        )}

        {gameState === 'battle' && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Left Panel - Player Stats */}
            <div className="space-y-4">
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 text-cyan-400">Your Stats</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold">Health</span>
                      <span className="text-green-400">{player.health}/100 HP</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-6">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-6 rounded-full transition-all duration-500 shadow-lg shadow-green-500/50"
                        style={{ width: `${player.health}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl mb-2">🦸</div>
                    <p className="text-sm text-gray-400">Code Warrior</p>
                    <p className="text-xs text-gray-500">Submissions: {player.submissions}</p>
                    <p className="text-xs text-yellow-400">Score: {player.score}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 text-red-400">Opponent</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold">Health</span>
                      <span className="text-red-400">{opponent.health}/100 HP</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-6">
                      <div 
                        className="bg-gradient-to-r from-red-500 to-orange-500 h-6 rounded-full transition-all duration-500 shadow-lg shadow-red-500/50"
                        style={{ width: `${opponent.health}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl mb-2">👹</div>
                    <p className="text-sm text-gray-400">Code Beast</p>
                    <p className="text-xs text-gray-500">Submissions: {opponent.submissions}</p>
                    <p className="text-xs text-yellow-400">Score: {opponent.score}</p>
                  </div>
                </div>
              </div>

              {/* Battle Timer */}
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 text-yellow-400">Battle Timer</h3>
                <div className="text-center">
                  <div className={`text-4xl font-bold ${timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </div>
                  <p className="text-sm text-gray-400 mt-2">Time remaining</p>
                </div>
              </div>
            </div>

            {/* Center Panel - Puzzle & Code Editor */}
            <div className="space-y-4 xl:col-span-2">
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-purple-400">{currentPuzzle.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    currentPuzzle.difficulty === 'Easy' ? 'bg-green-600' :
                    currentPuzzle.difficulty === 'Medium' ? 'bg-yellow-600' : 'bg-red-600'
                  }`}>
                    {currentPuzzle.difficulty}
                  </span>
                </div>
                <p className="text-gray-300 mb-4">{currentPuzzle.description}</p>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold mb-3 text-gray-400">Sample Test Cases:</h4>
                  {currentPuzzle.testCases.filter(tc => !tc.isHidden).map((testCase, index) => (
                    <div key={index} className="mb-3 p-3 bg-gray-800/50 rounded border border-gray-700">
                      <div className="mb-2">
                        <span className="text-gray-400 font-semibold">Input:</span>
                        <div className="mt-1 text-green-400 font-mono text-sm bg-black/30 p-2 rounded">
                          {testCase.input}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400 font-semibold">Expected Output:</span>
                        <div className="mt-1 text-blue-400 font-mono text-sm bg-black/30 p-2 rounded">
                          {testCase.expectedOutput}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 text-purple-400">Code Editor</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <select
                      value={language}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="bg-gray-700 text-white px-3 py-1 rounded text-sm font-mono border border-gray-600 focus:border-purple-500 focus:outline-none"
                    >
                      <option value="cpp">C++</option>
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="java">Java</option>
                    </select>
                    <div className="flex gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                  
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full h-80 bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                    placeholder="// Write your solution here..."
                  />
                </div>
                <button 
                  onClick={runCode}
                  disabled={isRunning}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 px-4 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-green-500/25 disabled:opacity-50"
                >
                  {isRunning ? '⏳ Running...' : '⚡ Submit Solution'}
                </button>
              </div>

              {/* Hint and Solution Section */}
              <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                <div className="flex gap-3 mb-4">
                  <button 
                    onClick={() => setShowHint(!showHint)}
                    className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    💡 {showHint ? 'Hide' : 'Show'} Hint
                  </button>
                  <button 
                    onClick={() => setShowSolution(!showSolution)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-4 py-2 rounded-lg font-semibold transition-all"
                  >
                    🔓 {showSolution ? 'Hide' : 'Show'} Solution
                  </button>
                </div>
                
                {showHint && (
                  <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4 mb-4">
                    <h4 className="text-yellow-400 font-semibold mb-2">Hint:</h4>
                    <p className="text-yellow-200 text-sm">{getHint(currentPuzzle)}</p>
                  </div>
                )}
                
                {showSolution && (
                  <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-4">
                    <h4 className="text-purple-400 font-semibold mb-2">Solution ({language.toUpperCase()}):</h4>
                    <pre className="text-purple-200 text-xs font-mono bg-gray-900 p-3 rounded overflow-x-auto">
                      {getSolution(currentPuzzle, language)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Test Results */}
              {testResults.length > 0 && (
                <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
                  <h3 className="text-xl font-bold mb-4 text-yellow-400">Test Results</h3>
                  <div className="space-y-2">
                    {testResults.map((result, index) => (
                      <div key={index} className={`p-3 rounded-lg font-mono text-sm ${
                        result.passed ? 'bg-green-900/30 border border-green-500' : 'bg-red-900/30 border border-red-500'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={result.isHidden ? 'text-yellow-400' : 'text-gray-300'}>
                            {result.isHidden ? '🔒 Hidden Test' : `Test ${index + 1}`}
                          </span>
                          <span className={result.passed ? 'text-green-400' : 'text-red-400'}>
                            {result.passed ? '✅ PASS' : '❌ FAIL'}
                          </span>
                        </div>
                        {!result.passed && !result.isHidden && (
                          <div className="mt-2 text-xs">
                            <div>Expected: <span className="text-blue-400">{result.expected}</span></div>
                            <div>Actual: <span className="text-red-400">{result.actual}</span></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Battle Log */}
            <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 text-yellow-400">Battle Log</h3>
              <div className="h-96 overflow-y-auto bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                {battleLog.length === 0 ? (
                  <p className="text-gray-500 text-center">⏳ Battle log will appear here...</p>
                ) : (
                  <div className="space-y-2">
                    {battleLog.map((log, index) => (
                      <div key={index} className="text-sm font-mono text-gray-300 border-l-2 border-cyan-500 pl-3 py-1">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {(gameState === 'victory' || gameState === 'defeat' || gameState === 'draw') && (
          <div className="text-center">
            <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-12 max-w-md mx-auto">
              <div className="text-8xl mb-4">
                {gameState === 'victory' ? '🏆' : gameState === 'defeat' ? '💀' : '🤝'}
              </div>
              <h2 className={`text-4xl font-bold mb-4 ${
                gameState === 'victory' ? 'text-green-400' : 
                gameState === 'defeat' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {gameState === 'victory' ? 'Victory!' : gameState === 'defeat' ? 'Defeat!' : 'Draw!'}
              </h2>
              <div className="text-gray-300 mb-8">
                <p className="mb-2">
                  {gameState === 'victory' ? 'You defeated your opponent!' : 
                   gameState === 'defeat' ? 'You were defeated!' : 'Both players have equal HP!'}
                </p>
                <div className="text-sm space-y-1">
                  <p>Your Submissions: {player.submissions}</p>
                  <p>Opponent Submissions: {opponent.submissions}</p>
                </div>
              </div>
              <button 
                onClick={resetGame}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-8 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
