import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { ChannelType } from 'discord.js'

jest.mock('@lucky/shared/utils', () => ({
    infoLog: jest.fn(),
    errorLog: jest.fn(),
}))

import serversetupCommand from './serversetup'

function createGuild() {
    const welcomeSend = jest.fn().mockResolvedValue(undefined)

    const roles = [
        { id: 'everyone', name: '@everyone' },
        { id: 'maintainer', name: 'Maintainer' },
        { id: 'contributor', name: 'Contributor' },
        { id: 'community', name: 'Community' },
    ]

    const categories = [
        { id: 'cat-info', name: '📢 INFO', type: ChannelType.GuildCategory },
        {
            id: 'cat-community',
            name: '💬 COMMUNITY',
            type: ChannelType.GuildCategory,
        },
        { id: 'cat-support', name: '🛠️ SUPPORT', type: ChannelType.GuildCategory },
        {
            id: 'cat-development',
            name: '🏗️ DEVELOPMENT',
            type: ChannelType.GuildCategory,
        },
        { id: 'cat-chill', name: '🎵 CHILL', type: ChannelType.GuildCategory },
    ]

    const textChannels = [
        ['announcements', 'cat-info'],
        ['rules', 'cat-info'],
        ['roadmap', 'cat-info'],
        ['general', 'cat-community'],
        ['introductions', 'cat-community'],
        ['showcase', 'cat-community'],
        ['getting-started', 'cat-support'],
        ['siza-help', 'cat-support'],
        ['mcp-gateway-help', 'cat-support'],
        ['troubleshooting', 'cat-support'],
        ['contributing', 'cat-development'],
        ['architecture', 'cat-development'],
        ['releases', 'cat-development'],
        ['off-topic', 'cat-chill'],
        ['music-bot', 'cat-chill'],
    ].map(([name, parentId]) => ({
        id: `${name}-id`,
        name,
        parentId,
        type: ChannelType.GuildText,
        send: name === 'general' ? welcomeSend : undefined,
    }))

    const channels = [...categories, ...textChannels]

    return {
        name: 'Criativaria',
        roles: {
            cache: {
                find: (predicate: (value: unknown) => boolean) =>
                    roles.find((role) => predicate(role)),
                everyone: { id: 'everyone' },
            },
            create: jest.fn(),
        },
        channels: {
            cache: {
                find: (predicate: (value: unknown) => boolean) =>
                    channels.find((channel) => predicate(channel)),
            },
            create: jest.fn(),
        },
        setIcon: jest.fn(),
        setSplash: jest.fn(),
        setBanner: jest.fn(),
        _welcomeSend: welcomeSend,
    } as any
}

function createInteraction(guild: any) {
    return {
        guild,
        options: {
            getString: jest.fn((_name: string, required: boolean) =>
                required ? 'forge-space' : null,
            ),
        },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
    } as any
}

describe('serversetup command', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('does not mutate guild visual identity during setup', async () => {
        const guild = createGuild()
        const interaction = createInteraction(guild)

        await serversetupCommand.execute({ interaction } as any)

        expect(guild.setIcon).not.toHaveBeenCalled()
        expect(guild.setSplash).not.toHaveBeenCalled()
        expect(guild.setBanner).not.toHaveBeenCalled()
        expect(guild._welcomeSend).toHaveBeenCalledTimes(1)

        const finalReply =
            interaction.editReply.mock.calls[
                interaction.editReply.mock.calls.length - 1
            ][0]
        expect(finalReply).toContain(
            'Lucky preserves guild identity',
        )
    })
})
