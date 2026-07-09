import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const chromePath =
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const appUrl = 'http://127.0.0.1:4173'
const port = 9333
const screenshotDir = resolve('docs/screenshots')
const userDataDir = resolve('.tmp-chrome-screenshots')

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))

const fetchJson = async (url, options) => {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(`Request failed: ${url}`)
  return response.json()
}

const waitForChrome = async () => {
  for (let index = 0; index < 50; index += 1) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`)
    } catch {
      await wait(100)
    }
  }

  throw new Error('Chrome did not start')
}

const connect = (webSocketUrl) =>
  new Promise((resolveConnect, reject) => {
    const socket = new WebSocket(webSocketUrl)
    socket.addEventListener('open', () => resolveConnect(socket), { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

const createClient = (socket) => {
  let id = 0
  const callbacks = new Map()
  const eventListeners = new Map()

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && callbacks.has(message.id)) {
      callbacks.get(message.id)(message)
      callbacks.delete(message.id)
    }
    if (message.method && eventListeners.has(message.method)) {
      for (const listener of eventListeners.get(message.method)) listener(message.params)
    }
  })

  return {
    send(method, params = {}) {
      id += 1
      socket.send(JSON.stringify({ id, method, params }))
      return new Promise((resolveSend, reject) => {
        callbacks.set(id, (message) => {
          if (message.error) reject(new Error(message.error.message))
          else resolveSend(message.result)
        })
      })
    },
    once(method) {
      return new Promise((resolveOnce) => {
        const listener = (params) => {
          eventListeners.set(
            method,
            eventListeners.get(method).filter((candidate) => candidate !== listener),
          )
          resolveOnce(params)
        }
        eventListeners.set(method, [...(eventListeners.get(method) ?? []), listener])
      })
    },
  }
}

const capture = async (client, name) => {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  await writeFile(resolve(screenshotDir, `${name}.png`), Buffer.from(result.data, 'base64'))
}

await mkdir(screenshotDir, { recursive: true })
await rm(userDataDir, { recursive: true, force: true })

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  '--window-size=1440,1000',
  'about:blank',
])

try {
  await waitForChrome()
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(appUrl)}`, {
    method: 'PUT',
  })
  const socket = await connect(target.webSocketDebuggerUrl)
  const client = createClient(socket)

  await client.send('Page.enable')
  await client.send('Runtime.enable')
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await client.once('Page.loadEventFired')
  await wait(800)
  await capture(client, 'main')

  await client.send('Runtime.evaluate', {
    expression: "document.documentElement.classList.add('dark')",
  })
  await wait(300)
  await capture(client, 'dark-mode')

  await client.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `
      new Promise((resolve, reject) => {
        document.documentElement.classList.remove('dark');
        const request = indexedDB.open('noteflow');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('conflicts', 'readwrite');
          transaction.objectStore('conflicts').put({
            id: 'note:00000000-0000-4000-8000-0000000000aa',
            entity: 'note',
            detectedAt: Date.now(),
            localVersion: {
              id: '00000000-0000-4000-8000-0000000000aa',
              title: 'Interview notes',
              content: 'Local draft with the candidate-facing explanation.',
              tags: ['portfolio', 'sync'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              baseVersion: null
            },
            serverVersion: {
              id: '00000000-0000-4000-8000-0000000000aa',
              title: 'Interview notes',
              content: 'Server copy edited from another tab.',
              tags: ['portfolio'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date(Date.now() + 1000).toISOString(),
              deletedAt: null,
              baseVersion: null
            }
          });
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => reject(transaction.error);
        };
      })
    `,
  })
  await wait(500)
  await client.send('Runtime.evaluate', {
    expression: `
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent.includes('need review'))
        ?.click()
    `,
  })
  await wait(500)
  await capture(client, 'conflict-resolver')
  socket.close()
} finally {
  chrome.kill()
  await wait(500)
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
}
