const SSE_HEARTBEAT_MS = 25_000

const serializeEvent = (event, data) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

export const createSyncEventBroker = ({ heartbeatMs = SSE_HEARTBEAT_MS } = {}) => {
  const connectionsByUser = new Map()

  const connect = (userId, response, clientId = null) => {
    response.status(200)
    response.set({
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
      'X-Accel-Buffering': 'no',
    })
    response.flushHeaders?.()

    const connection = { clientId, response }
    const connections = connectionsByUser.get(userId) ?? new Set()
    connections.add(connection)
    connectionsByUser.set(userId, connections)
    response.write(serializeEvent('connected', { connected: true }))

    const heartbeatId = setInterval(() => response.write(': heartbeat\n\n'), heartbeatMs)
    heartbeatId.unref?.()

    let closed = false
    const disconnect = () => {
      if (closed) return
      closed = true
      clearInterval(heartbeatId)
      connections.delete(connection)
      if (connections.size === 0) connectionsByUser.delete(userId)
    }

    response.once?.('close', disconnect)
    response.once?.('finish', disconnect)
    return disconnect
  }

  const publishChanges = (userId, { excludeClientId = null, changes }) => {
    const connections = connectionsByUser.get(userId)
    if (!connections) return 0

    let delivered = 0
    for (const connection of connections) {
      if (excludeClientId && connection.clientId === excludeClientId) continue
      connection.response.write(serializeEvent('sync-update', changes))
      delivered += 1
    }
    return delivered
  }

  return { connect, publishChanges }
}
