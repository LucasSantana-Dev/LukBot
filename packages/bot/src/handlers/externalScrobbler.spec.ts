import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Events, type Message } from 'discord.js'
import { handleExternalScrobbler } from './externalScrobbler'

const isLastFmConfiguredMock = jest.fn()
const getSessionKeyForUserMock = jest.fn()
const updateNowPlayingMock = jest.fn()
const scrobbleMock = jest.fn()
const infoLogMock = jest.fn()
const errorLogMock = jest.fn()
const debugLogMock = jest.fn()

jest.mock('../lastfm', () => ({
    isLastFmConfigured: (...args: unknown[]) => isLastFmConfiguredMock(...args),
    getSessionKeyForUser: (...args: unknown[]) => getSessionKeyForUserMock(...args),
    updateNowPlaying: (...args: unknown[]) => updateNowPlayingMock(...args),
    scrobble: (...args: unknown[]) => scrobbleMock(...args),
}))

jest.mock('@lucky/shared/utils', () => ({
    infoLog: (...args: unknown[]) => infoLogMock(...args),
    errorLog: (...args: unknown[]) => errorLogMock(...args),
    debugLog: (...args: unknown[]) => debugLogMock(...args),
}))

function createVoiceChannel() {
    return {
        members: new Map([
            ['user-1', { user: { bot: false, username: 'User One' } }],
            ['bot-2', { user: { bot: true, username: 'Bot Two' } }],
        ]),
        isVoiceBased: () => true,
    }
}

function createMessage(
    content: string,
    guild: {
        id: string
        members: { cache: Map<string, { voice: { channel: unknown } }> }
    },
): Message {
    return {
        content,
        author: {
            id: 'music-bot',
            bot: true,
            username: 'Rythm',
        },
        guild,
    } as unknown as Message
}

describe('externalScrobbler', () => {
    const originalDateNow = Date.now

    beforeEach(() => {
        jest.clearAllMocks()
        isLastFmConfiguredMock.mockReturnValue(true)
        getSessionKeyForUserMock.mockResolvedValue('session-1')
    })

    afterEach(() => {
        Date.now = originalDateNow
    })

    it('parses now-playing line and updates Last.fm for voice members', async () => {
        const listeners = new Map<string, (message: Message) => Promise<void>>()
        const voiceChannel = createVoiceChannel()
        const guild = {
            id: 'guild-1',
            members: {
                cache: new Map([
                    ['music-bot', { voice: { channel: voiceChannel } }],
                ]),
            },
            channels: {
                cache: {
                    filter: jest.fn(() => new Map([['voice-1', voiceChannel]])),
                },
            },
        }
        const client = {
            on: jest.fn((event: string, handler: (message: Message) => Promise<void>) => {
                listeners.set(event, handler)
            }),
            guilds: { cache: new Map([['guild-1', guild]]) },
        }

        handleExternalScrobbler(client as unknown as never)
        const handler = listeners.get(Events.MessageCreate)
        expect(handler).toBeDefined()

        await handler?.(
            createMessage('**Now playing: My Song – My Artist**', guild),
        )

        expect(updateNowPlayingMock).toHaveBeenCalledWith(
            'My Artist',
            'My Song',
            undefined,
            'session-1',
        )
        expect(getSessionKeyForUserMock).toHaveBeenCalledWith('user-1')
    })

    it('scrobbles previous track on next now-playing event after 30 seconds', async () => {
        Date.now = jest
            .fn()
            .mockReturnValueOnce(100000)
            .mockReturnValueOnce(140000)
            .mockReturnValueOnce(140000)

        const listeners = new Map<string, (message: Message) => Promise<void>>()
        const voiceChannel = createVoiceChannel()
        const guild = {
            id: 'guild-2',
            members: {
                cache: new Map([
                    ['music-bot', { voice: { channel: voiceChannel } }],
                ]),
            },
            channels: {
                cache: {
                    filter: jest.fn(() => new Map([['voice-2', voiceChannel]])),
                },
            },
        }
        const client = {
            on: jest.fn((event: string, handler: (message: Message) => Promise<void>) => {
                listeners.set(event, handler)
            }),
            guilds: { cache: new Map([['guild-2', guild]]) },
        }

        handleExternalScrobbler(client as unknown as never)
        const handler = listeners.get(Events.MessageCreate)
        expect(handler).toBeDefined()

        await handler?.(createMessage('Now playing: First Song — First Artist', guild))
        await handler?.(createMessage('Now playing: Second Song - Second Artist', guild))

        expect(scrobbleMock).toHaveBeenCalledWith(
            'First Artist',
            'First Song',
            100,
            40,
            'session-1',
        )
        expect(updateNowPlayingMock).toHaveBeenCalledWith(
            'Second Artist',
            'Second Song',
            undefined,
            'session-1',
        )
    })
})
