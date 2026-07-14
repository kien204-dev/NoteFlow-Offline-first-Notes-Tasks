import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSyncEventStream } from './syncEventStream'

const encoder = new TextEncoder()

const streamResponse = (...chunks: string[]) => {
  let index = 0
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: vi.fn(async () =>
          index < chunks.length
            ? { done: false, value: encoder.encode(chunks[index++]) }
            : { done: true, value: undefined },
        ),
      }),
    },
  } as unknown as Response
}

describe('createSyncEventStream', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sends the bearer token and triggers a sync for sync-update events', async () => {
    const onChange = vi.fn()
    const fetcher = vi.fn(async () =>
      streamResponse('event: connected\ndata: {}\n\n', 'event: sync-update\ndata: {"notes":1}\n\n'),
    )
    const connection = createSyncEventStream({
      accessToken: 'memory-token',
      clientId: 'tab-b',
      fetcher: fetcher as typeof fetch,
      onChange,
      reconnectDelays: [60_000],
    })

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:4000/api/sync/events',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer memory-token',
          'X-NoteFlow-Client-Id': 'tab-b',
        }),
      }),
    )
    connection.close()
  })

  it('reconnects with backoff after the stream disconnects', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(async () => streamResponse())
    const connection = createSyncEventStream({
      accessToken: 'memory-token',
      clientId: 'tab-b',
      fetcher: fetcher as typeof fetch,
      onChange: vi.fn(),
      reconnectDelays: [1_000],
    })

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetcher).toHaveBeenCalledTimes(2)
    connection.close()
  })
})
