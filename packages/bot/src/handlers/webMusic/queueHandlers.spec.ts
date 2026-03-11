import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import {
    handleImportPlaylist,
    handleQueueClear,
    handleQueueMove,
    handleQueueRemove,
} from './queueHandlers'

const publishStateMock = jest.fn()
const buildQueueStateMock = jest.fn()
const resolveGuildQueueMock = jest.fn()

jest.mock('@lucky/shared/services', () => ({
    musicControlService: {
        publishState: (...args: unknown[]) => publishStateMock(...args),
    },
}))

jest.mock('./mappers', () => ({
    buildQueueState: (...args: unknown[]) => buildQueueStateMock(...args),
}))

jest.mock('../../utils/music/queueResolver', () => ({
    resolveGuildQueue: (...args: unknown[]) => resolveGuildQueueMock(...args),
}))

type Track = { id: string }

function createQueue(initialTracks: Track[]) {
    const state = [...initialTracks]
    const clear = jest.fn(() => {
        state.length = 0
    })
    const addTrack = jest.fn((track: Track) => {
        state.push(track)
    })
    const removeTrack = jest.fn((index: number) => {
        state.splice(index, 1)
    })
    const play = jest.fn(async () => {})
    const isPlaying = jest.fn(() => false)
    const isPaused = jest.fn(() => false)

    return {
        queue: {
            tracks: {
                toArray: () => [...state],
                clear,
            },
            addTrack,
            removeTrack,
            node: {
                play,
                isPlaying,
                isPaused,
            },
        },
        clear,
        addTrack,
        removeTrack,
        play,
        isPlaying,
        isPaused,
    }
}

describe('queueHandlers', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        buildQueueStateMock.mockResolvedValue({ guildId: 'guild-1' })
    })

    it('handleQueueMove returns failure when queue is missing', async () => {
        resolveGuildQueueMock.mockReturnValue({ queue: null })

        const result = await handleQueueMove(
            {} as any,
            {
                id: 'cmd-1',
                guildId: 'guild-1',
                data: { from: 0, to: 1 },
            } as any,
        )

        expect(result.success).toBe(false)
        expect(result.error).toBe('No active queue')
    })

    it('handleQueueMove validates positions', async () => {
        const { queue } = createQueue([{ id: 'a' }])
        resolveGuildQueueMock.mockReturnValue({ queue })

        const result = await handleQueueMove(
            {} as any,
            {
                id: 'cmd-2',
                guildId: 'guild-1',
                data: { from: 2, to: 0 },
            } as any,
        )

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid track positions')
    })

    it('handleQueueMove reorders tracks and publishes state', async () => {
        const queueState = createQueue([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
        resolveGuildQueueMock.mockReturnValue({ queue: queueState.queue })

        const result = await handleQueueMove(
            {} as any,
            {
                id: 'cmd-3',
                guildId: 'guild-1',
                data: { from: 0, to: 2 },
            } as any,
        )

        expect(result.success).toBe(true)
        expect(queueState.clear).toHaveBeenCalled()
        expect(
            queueState.addTrack.mock.calls.map(([track]) => track.id),
        ).toEqual(['b', 'c', 'a'])
        expect(publishStateMock).toHaveBeenCalledWith({ guildId: 'guild-1' })
    })

    it('handleQueueRemove validates index', async () => {
        const { queue } = createQueue([{ id: 'a' }])
        resolveGuildQueueMock.mockReturnValue({ queue })

        const result = await handleQueueRemove(
            {} as any,
            {
                id: 'cmd-4',
                guildId: 'guild-1',
                data: { index: 3 },
            } as any,
        )

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid track index')
    })

    it('handleQueueRemove removes track and publishes state', async () => {
        const queueState = createQueue([{ id: 'a' }, { id: 'b' }])
        resolveGuildQueueMock.mockReturnValue({ queue: queueState.queue })

        const result = await handleQueueRemove(
            {} as any,
            {
                id: 'cmd-5',
                guildId: 'guild-1',
                data: { index: 1 },
            } as any,
        )

        expect(result.success).toBe(true)
        expect(queueState.removeTrack).toHaveBeenCalledWith(1)
        expect(publishStateMock).toHaveBeenCalledWith({ guildId: 'guild-1' })
    })

    it('handleQueueClear clears queue and publishes state', async () => {
        const queueState = createQueue([{ id: 'a' }])
        resolveGuildQueueMock.mockReturnValue({ queue: queueState.queue })

        const result = await handleQueueClear(
            {} as any,
            {
                id: 'cmd-6',
                guildId: 'guild-1',
                data: {},
            } as any,
        )

        expect(result.success).toBe(true)
        expect(queueState.clear).toHaveBeenCalled()
        expect(publishStateMock).toHaveBeenCalledWith({ guildId: 'guild-1' })
    })

    it('handleImportPlaylist validates url and queue', async () => {
        resolveGuildQueueMock.mockReturnValue({ queue: null })

        const missingUrl = await handleImportPlaylist(
            {} as any,
            {
                id: 'cmd-7',
                guildId: 'guild-1',
                data: {},
            } as any,
        )
        expect(missingUrl.success).toBe(false)
        expect(missingUrl.error).toBe('No URL provided')

        const missingQueue = await handleImportPlaylist(
            {} as any,
            {
                id: 'cmd-8',
                guildId: 'guild-1',
                data: { url: 'https://spotify.com/playlist/1' },
            } as any,
        )
        expect(missingQueue.success).toBe(false)
        expect(missingQueue.error).toBe(
            'No active queue. Start playing from Discord first.',
        )
    })

    it('handleImportPlaylist returns failure when no tracks are found', async () => {
        const queueState = createQueue([])
        resolveGuildQueueMock.mockReturnValue({ queue: queueState.queue })

        const result = await handleImportPlaylist(
            {
                player: {
                    search: jest.fn(async () => ({ tracks: [] })),
                },
            } as any,
            {
                id: 'cmd-9',
                guildId: 'guild-1',
                data: { url: 'https://example.com/list' },
            } as any,
        )

        expect(result.success).toBe(false)
        expect(result.error).toBe('No tracks found in playlist')
    })

    it('handleImportPlaylist adds tracks, plays, and detects spotify source', async () => {
        const queueState = createQueue([])
        resolveGuildQueueMock.mockReturnValue({ queue: queueState.queue })

        const tracks = [{ id: 't1' }, { id: 't2' }]
        const result = await handleImportPlaylist(
            {
                player: {
                    search: jest.fn(async () => ({
                        tracks,
                        playlist: { title: 'Mix 1' },
                    })),
                },
            } as any,
            {
                id: 'cmd-10',
                guildId: 'guild-1',
                data: { url: 'https://open.spotify.com/playlist/123' },
            } as any,
        )

        expect(result.success).toBe(true)
        expect(queueState.addTrack).toHaveBeenCalledTimes(2)
        expect(queueState.play).toHaveBeenCalled()
        expect(result.data).toEqual({
            tracksAdded: 2,
            playlistName: 'Mix 1',
            source: 'spotify',
        })
    })

    it('handleImportPlaylist detects youtube and unknown sources', async () => {
        const queueState = createQueue([])
        queueState.isPlaying.mockReturnValue(true)
        resolveGuildQueueMock.mockReturnValue({ queue: queueState.queue })

        const client = {
            player: {
                search: jest
                    .fn()
                    .mockResolvedValueOnce({
                        tracks: [{ id: 'yt' }],
                        playlist: { title: 'YT List' },
                    })
                    .mockResolvedValueOnce({
                        tracks: [{ id: 'x' }],
                        playlist: undefined,
                    }),
            },
        } as any

        const youtubeResult = await handleImportPlaylist(client, {
            id: 'cmd-11',
            guildId: 'guild-1',
            data: { url: 'https://youtu.be/abc123' },
        } as any)

        const unknownResult = await handleImportPlaylist(client, {
            id: 'cmd-12',
            guildId: 'guild-1',
            data: { url: 'https://example.org/list' },
        } as any)

        expect(youtubeResult.success).toBe(true)
        expect(youtubeResult.data).toMatchObject({ source: 'youtube' })
        expect(unknownResult.success).toBe(true)
        expect(unknownResult.data).toMatchObject({
            source: 'unknown',
            playlistName: 'Unknown Playlist',
        })
        expect(queueState.play).not.toHaveBeenCalled()
    })
})
