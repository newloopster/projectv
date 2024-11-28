import WebSocket from 'ws'
import http from 'http'
import { v4 as uuidv4 } from 'uuid'

const server = http.createServer()
const wss = new WebSocket.Server({ server })

interface User {
  id: string
  ws: WebSocket
  partner?: string
}

const users: Map<string, User> = new Map()
const waitingUsers: string[] = []

wss.on('connection', (ws: WebSocket) => {
  const userId = uuidv4()
  users.set(userId, { id: userId, ws })

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message)
    
      switch (data.type) {
        case 'find_partner':
          findPartner(userId)
          break
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          if (users.get(userId)?.partner) {
            const partnerWs = users.get(users.get(userId)!.partner!)?.ws
            if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
              partnerWs.send(JSON.stringify(data))
            }
          }
          break
        case 'disconnect':
          disconnectUsers(userId)
          break
        default:
          console.warn(`Unhandled message type: ${data.type}`)
      }
    } catch (error) {
      console.error('Error processing message:', error)
    }
  })

  ws.on('close', () => {
    disconnectUsers(userId)
    users.delete(userId)
    const index = waitingUsers.indexOf(userId)
    if (index > -1) {
      waitingUsers.splice(index, 1)
    }
  })
})

function findPartner(userId: string) {
  if (waitingUsers.length > 0) {
    const partnerId = waitingUsers.shift()!
    users.get(userId)!.partner = partnerId
    users.get(partnerId)!.partner = userId
    
    users.get(userId)!.ws.send(JSON.stringify({ type: 'partner_found', partnerId }))
    users.get(partnerId)!.ws.send(JSON.stringify({ type: 'partner_found', partnerId: userId }))
  } else {
    waitingUsers.push(userId)
  }
}

function disconnectUsers(userId: string) {
  const user = users.get(userId)
  if (user && user.partner) {
    const partner = users.get(user.partner)
    if (partner) {
      partner.partner = undefined
      partner.ws.send(JSON.stringify({ type: 'partner_disconnected' }))
      waitingUsers.push(partner.id)
    }
    user.partner = undefined
  }
}

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Signaling server is running on port ${PORT}`)
})

