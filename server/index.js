import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'

import authRouter from './routes/auth.js'
import pricesRouter from './routes/prices.js'
import searchRouter from './routes/search.js'
import ordersRouter from './routes/orders.js'
import portfolioRouter from './routes/portfolio.js'
import journalRouter from './routes/journal.js'
import groupsRouter from './routes/groups.js'
import watchlistRouter from './routes/watchlist.js'
import chartRouter from './routes/chart.js'

import * as priceCache from './services/priceCache.js'
import * as orderEngine from './services/orderEngine.js'
import * as snapshotService from './services/snapshotService.js'
import * as instrumentsCache from './services/instrumentsCache.js'

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 3001

// ─── WebSocket server ────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' })

const clients = new Set()

wss.on('connection', (ws, req) => {
  clients.add(ws)
  console.log(`[ws] Client connected. Total: ${clients.size}`)

  // Send current prices immediately on connect
  const prices = priceCache.getAllPrices()
  if (Object.keys(prices).length > 0) {
    ws.send(JSON.stringify({ type: 'prices', data: prices }))
  }

  ws.on('close', () => {
    clients.delete(ws)
    console.log(`[ws] Client disconnected. Total: ${clients.size}`)
  })

  ws.on('error', err => {
    console.error('[ws] Error:', err.message)
    clients.delete(ws)
  })

  // Heartbeat
  const heartbeat = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }))
    } else {
      clearInterval(heartbeat)
    }
  }, 30000)
})

export function broadcast(data) {
  const msg = JSON.stringify(data)
  clients.forEach(client => {
    if (client.readyState === 1) {
      try { client.send(msg) } catch (e) { /* ignore */ }
    }
  })
}

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ].filter(Boolean)
    if (!origin || allowed.includes(origin)) cb(null, true)
    else cb(new Error('Not allowed by CORS'))
  },
  credentials: true
}))
app.use(express.json({ limit: '2mb' }))

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/prices', pricesRouter)
app.use('/api/search', searchRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/portfolio', portfolioRouter)
app.use('/api/journal', journalRouter)
app.use('/api/groups', groupsRouter)
app.use('/api/watchlist', watchlistRouter)
app.use('/api/chart', chartRouter)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    wsClients: clients.size
  })
})

// ─── Start ───────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 TradeArena server running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket server on ws://localhost:${PORT}/ws\n`)

  // Init services
  orderEngine.init(broadcast)
  snapshotService.init()

  // Init price cache with broadcast + order engine tick
  priceCache.init(broadcast, orderEngine.tick)

  // Start polling
  priceCache.start()
  orderEngine.start()
  snapshotService.start()

  // Load full instruments list in background (doesn't block startup)
  instrumentsCache.init()
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => process.exit(0))
})
