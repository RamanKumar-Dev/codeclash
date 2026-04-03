import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3003"],
    methods: ["GET", "POST"]
  }
})

// Middleware
app.use(cors())
app.use(express.json())

// Game state
interface User {
  id: string
  name: string
  rating: number
  wins: number
  losses: number
  health: number
  maxHealth: number
  score: number
  submissions: number
}

interface Battle {
  id: string
  player1: User & { ready: boolean }
  player2: User & { ready: boolean }
  puzzle: Puzzle
  startTime: number | null
  status: 'waiting' | 'active' | 'ended'
  timerInterval?: NodeJS.Timeout
}

interface Puzzle {
  id: string
  title: string
  difficulty: string
  timeLimit: number
  description: string
  testCases: TestCase[]
}

interface TestCase {
  input: string
  expected: any
}

const matchmakingQueue: User[] = []
const activeBattles = new Map<string, Battle>()
const userSockets = new Map<string, string>()

// User data (temporary - will move to database)
const users = new Map<string, User>()

// Puzzle data
const puzzles: Puzzle[] = [
  {
    id: 'array-sum',
    title: 'Array Sum',
    difficulty: 'Easy',
    timeLimit: 60,
    description: 'Calculate the sum of all elements in an array',
    testCases: [
      { input: '[1, 2, 3, 4]', expected: 10 },
      { input: '[-1, 5, -3]', expected: 1 },
      { input: '[]', expected: 0 }
    ]
  },
  {
    id: 'factorial',
    title: 'Factorial',
    difficulty: 'Medium', 
    timeLimit: 90,
    description: 'Calculate factorial of a number',
    testCases: [
      { input: '5', expected: 120 },
      { input: '0', expected: 1 },
      { input: '1', expected: 1 }
    ]
  },
  {
    id: 'palindrome',
    title: 'Palindrome Check',
    difficulty: 'Easy',
    timeLimit: 75,
    description: 'Check if a string is a palindrome',
    testCases: [
      { input: '"racecar"', expected: true },
      { input: '"hello"', expected: false },
      { input: '"a"', expected: true }
    ]
  }
]

// Helper functions
function generateUserId(): string {
  return Math.random().toString(36).substr(2, 9)
}

function getRandomPuzzle(): Puzzle {
  return puzzles[Math.floor(Math.random() * puzzles.length)]
}

function calculateELO(player1Rating: number, player2Rating: number, winner: 'player1' | 'player2') {
  const K = 32
  const expectedScore1 = 1 / (1 + Math.pow(10, (player2Rating - player1Rating) / 400))
  const expectedScore2 = 1 / (1 + Math.pow(10, (player1Rating - player2Rating) / 400))
  
  if (winner === 'player1') {
    return {
      player1Rating: player1Rating + K * (1 - expectedScore1),
      player2Rating: player2Rating + K * (0 - expectedScore2)
    }
  } else {
    return {
      player1Rating: player1Rating + K * (0 - expectedScore1),
      player2Rating: player2Rating + K * (1 - expectedScore2)
    }
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)
  
  // User authentication/registration
  socket.on('user:register', (userData: { name?: string }) => {
    console.log('Registration request received:', userData)
    
    const userId = generateUserId()
    const user: User = {
      id: userId,
      name: userData.name || `User${userId.substr(0, 4)}`,
      rating: 1000,
      wins: 0,
      losses: 0,
      health: 100,
      maxHealth: 100,
      score: 0,
      submissions: 0
    }
    
    users.set(userId, user)
    userSockets.set(userId, socket.id)
    
    console.log(`User registered: ${user.name} (${userId})`)
    socket.emit('user:registered', { user })
  })
  
  // Join matchmaking queue
  socket.on('matchmaking:join', (userId: string) => {
    console.log('Join queue request from:', userId)
    
    const user = users.get(userId)
    if (!user) {
      socket.emit('error', { message: 'User not found' })
      return
    }
    
    // Check if already in queue
    if (matchmakingQueue.find(u => u.id === userId)) {
      socket.emit('error', { message: 'Already in matchmaking queue' })
      return
    }
    
    // Add to queue
    matchmakingQueue.push(user)
    userSockets.set(userId, socket.id)
    
    socket.emit('matchmaking:joined', { queueSize: matchmakingQueue.length })
    console.log(`${user.name} joined matchmaking queue (${matchmakingQueue.length} in queue)`)
    
    // Try to find match
    tryFindMatch()
  })
  
  // Leave matchmaking queue
  socket.on('matchmaking:leave', (userId: string) => {
    const index = matchmakingQueue.findIndex(u => u.id === userId)
    if (index !== -1) {
      matchmakingQueue.splice(index, 1)
      socket.emit('matchmaking:left')
      console.log(`User left matchmaking queue (${matchmakingQueue.length} remaining)`)
    }
  })
  
  // Ready for battle
  socket.on('battle:ready', (data: { userId: string; battleId: string }) => {
    const { userId, battleId } = data
    const battle = activeBattles.get(battleId)
    
    if (!battle) {
      socket.emit('error', { message: 'Battle not found' })
      return
    }
    
    console.log(`User ${userId} ready for battle ${battleId}`)
    
    // Mark player as ready
    if (battle.player1.id === userId) {
      battle.player1.ready = true
    } else if (battle.player2.id === userId) {
      battle.player2.ready = true
    }
    
    // Start battle if both players are ready
    if (battle.player1.ready && battle.player2.ready) {
      startBattle(battle)
    }
  })
  
  // Submit code solution
  socket.on('battle:submit', (data: { userId: string; battleId: string; code: string; language: string }) => {
    const { userId, battleId, code, language } = data
    const battle = activeBattles.get(battleId)
    
    if (!battle) {
      socket.emit('error', { message: 'Battle not found' })
      return
    }
    
    console.log(`Code submission from ${userId} in battle ${battleId}`)
    
    // Simulate code execution
    const submissionTime = Math.floor((Date.now() - (battle.startTime || Date.now())) / 1000)
    const isCorrect = Math.random() > 0.3 // 70% success rate for demo
    
    // Calculate damage
    let damage = 0
    if (isCorrect) {
      const baseDamage = 25
      const timeBonus = Math.max(0, Math.floor((battle.puzzle.timeLimit - submissionTime) / 10))
      const efficiencyBonus = Math.floor(Math.random() * 10) + 5
      damage = baseDamage + timeBonus + efficiencyBonus
    }
    
    // Update battle state
    if (battle.player1.id === userId) {
      battle.player1.submissions++
      battle.player1.score += isCorrect ? 20 : 0
      
      if (isCorrect) {
        battle.player2.health = Math.max(0, battle.player2.health - damage)
      }
    } else {
      battle.player2.submissions++
      battle.player2.score += isCorrect ? 20 : 0
      
      if (isCorrect) {
        battle.player1.health = Math.max(0, battle.player1.health - damage)
      }
    }
    
    // Send results to both players
    const player1Socket = userSockets.get(battle.player1.id)
    const player2Socket = userSockets.get(battle.player2.id)
    
    const result = {
      userId,
      isCorrect,
      damage,
      submissionTime,
      battleState: {
        player1: battle.player1,
        player2: battle.player2
      }
    }
    
    io.to(player1Socket).emit('battle:submission_result', result)
    io.to(player2Socket).emit('battle:submission_result', result)
    
    console.log(`Submission result: correct=${isCorrect}, damage=${damage}`)
    
    // Check for battle end
    if (battle.player1.health <= 0 || battle.player2.health <= 0) {
      endBattle(battle, 'health')
    }
  })
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
    
    // Remove from matchmaking queue
    const index = matchmakingQueue.findIndex(u => userSockets.get(u.id) === socket.id)
    if (index !== -1) {
      matchmakingQueue.splice(index, 1)
    }
    
    // Handle active battles
    for (const [battleId, battle] of activeBattles) {
      if (userSockets.get(battle.player1.id) === socket.id || 
          userSockets.get(battle.player2.id) === socket.id) {
        // End battle due to disconnect
        endBattle(battle, 'disconnect')
        break
      }
    }
    
    // Clean up user sockets mapping
    for (const [userId, socketId] of userSockets) {
      if (socketId === socket.id) {
        userSockets.delete(userId)
        break
      }
    }
  })
})

// Helper function to find matches
function tryFindMatch() {
  if (matchmakingQueue.length < 2) return
  
  // Simple pairing - take first two users
  const player1 = matchmakingQueue.shift()!
  const player2 = matchmakingQueue.shift()!
  
  // Create battle
  const battleId = generateUserId()
  const puzzle = getRandomPuzzle()
  
  const battle: Battle = {
    id: battleId,
    player1: {
      ...player1,
      health: 100,
      maxHealth: 100,
      score: 0,
      submissions: 0,
      ready: false
    },
    player2: {
      ...player2,
      health: 100,
      maxHealth: 100,
      score: 0,
      submissions: 0,
      ready: false
    },
    puzzle,
    startTime: null,
    status: 'waiting'
  }
  
  activeBattles.set(battleId, battle)
  
  // Notify players
  const player1Socket = userSockets.get(player1.id)
  const player2Socket = userSockets.get(player2.id)
  
  console.log(`Match found: ${player1.name} vs ${player2.name}`)
  
  io.to(player1Socket).emit('match:found', {
    battleId,
    opponent: player2,
    puzzle
  })
  
  io.to(player2Socket).emit('match:found', {
    battleId,
    opponent: player1,
    puzzle
  })
}

// Helper function to start battle
function startBattle(battle: Battle) {
  battle.status = 'active'
  battle.startTime = Date.now()
  
  const player1Socket = userSockets.get(battle.player1.id)
  const player2Socket = userSockets.get(battle.player2.id)
  
  console.log(`Battle started: ${battle.player1.name} vs ${battle.player2.name}`)
  
  // Start battle timer
  battle.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - (battle.startTime || Date.now())) / 1000)
    const timeRemaining = Math.max(0, battle.puzzle.timeLimit - elapsed)
    
    io.to(player1Socket).emit('battle:timer_update', { timeRemaining })
    io.to(player2Socket).emit('battle:timer_update', { timeRemaining })
    
    if (timeRemaining === 0) {
      clearInterval(battle.timerInterval)
      endBattle(battle, 'time')
    }
  }, 1000)
  
  // Notify players battle started
  io.to(player1Socket).emit('battle:started', { battle })
  io.to(player2Socket).emit('battle:started', { battle })
}

// Helper function to end battle
function endBattle(battle: Battle, reason: 'health' | 'time' | 'disconnect' = 'health') {
  if (battle.timerInterval) {
    clearInterval(battle.timerInterval)
  }
  
  let winner: User | null = null
  let loser: User | null = null
  
  if (reason === 'health') {
    winner = battle.player1.health > 0 ? battle.player1 : battle.player2
    loser = battle.player1.health > 0 ? battle.player2 : battle.player1
  } else if (reason === 'time') {
    if (battle.player1.health > battle.player2.health) {
      winner = battle.player1
      loser = battle.player2
    } else if (battle.player2.health > battle.player1.health) {
      winner = battle.player2
      loser = battle.player1
    } else {
      // Equal health - check scores
      if (battle.player1.score > battle.player2.score) {
        winner = battle.player1
        loser = battle.player2
      } else if (battle.player2.score > battle.player1.score) {
        winner = battle.player2
        loser = battle.player1
      } else {
        // True draw
        winner = null
        loser = null
      }
    }
  }
  
  // Update user stats
  if (winner && loser) {
    winner.wins++
    loser.losses++
    
    // Update ELO ratings
    const eloResult = calculateELO(
      users.get(winner.id)!.rating,
      users.get(loser.id)!.rating,
      winner.id === battle.player1.id ? 'player1' : 'player2'
    )
    
    users.get(winner.id)!.rating = eloResult.player1Rating
    users.get(loser.id)!.rating = eloResult.player2Rating
  }
  
  // Notify players
  const player1Socket = userSockets.get(battle.player1.id)
  const player2Socket = userSockets.get(battle.player2.id)
  
  const result = {
    winner: winner ? winner.id : null,
    loser: loser ? loser.id : null,
    isDraw: !winner,
    battleState: {
      player1: battle.player1,
      player2: battle.player2
    },
    reason
  }
  
  console.log(`Battle ended: ${winner ? winner.name : 'Draw'} (${reason})`)
  
  io.to(player1Socket).emit('battle:ended', result)
  io.to(player2Socket).emit('battle:ended', result)
  
  // Clean up
  activeBattles.delete(battle.id)
}

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    queueSize: matchmakingQueue.length, 
    activeBattles: activeBattles.size,
    onlineUsers: users.size
  })
})

app.get('/api/users', (req, res) => {
  const userList = Array.from(users.values()).map(u => ({
    id: u.id,
    name: u.name,
    rating: u.rating,
    wins: u.wins,
    losses: u.losses
  }))
  res.json(userList)
})

// Start server
const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 Code-Clash Multiplayer Server running on port ${PORT}`)
  console.log(`📊 Matchmaking queue: ${matchmakingQueue.length} users`)
  console.log(`⚔️ Active battles: ${activeBattles.size}`)
})
