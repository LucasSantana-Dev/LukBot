import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import guildconfigCommand from './guildconfig'

const captureGuildAutomationStateMock = jest.fn()
const createPlanMock = jest.fn()
const getStatusMock = jest.fn()
const listRunsMock = jest.fn()
const recordCaptureMock = jest.fn()
const runCutoverMock = jest.fn()
const updateRunStatusMock = jest.fn()
const applyAutomationModulesMock = jest.fn()

jest.mock('../../../utils/guildAutomation/captureGuildState', () => ({
    captureGuildAutomationState: (...args: unknown[]) =>
        captureGuildAutomationStateMock(...args),
}))

jest.mock('../../../utils/guildAutomation/applyPlan', () => ({
    applyAutomationModules: (...args: unknown[]) =>
        applyAutomationModulesMock(...args),
}))

jest.mock('@lucky/shared/services', () => ({
    guildAutomationService: {
        createPlan: (...args: unknown[]) => createPlanMock(...args),
        getStatus: (...args: unknown[]) => getStatusMock(...args),
        listRuns: (...args: unknown[]) => listRunsMock(...args),
        recordCapture: (...args: unknown[]) => recordCaptureMock(...args),
        runCutover: (...args: unknown[]) => runCutoverMock(...args),
        updateRunStatus: (...args: unknown[]) => updateRunStatusMock(...args),
    },
}))

jest.mock('@lucky/shared/utils', () => ({
    errorLog: jest.fn(),
}))

function createInteraction(subcommand: string, options: Record<string, unknown> = {}) {
    return {
        guild: {
            id: '123456789012345678',
            name: 'Criativaria',
            editOnboarding: jest.fn(),
        },
        client: {
            user: {
                id: '999999999999999999',
            },
        },
        user: {
            id: '888888888888888888',
        },
        options: {
            getSubcommand: jest.fn(() => subcommand),
            getBoolean: jest.fn((name: string) => options[name] ?? null),
        },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        replied: false,
        deferred: true,
    } as any
}

describe('guildconfig command', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        captureGuildAutomationStateMock.mockResolvedValue({
            version: 1,
            guild: { id: '123456789012345678', name: 'Criativaria' },
            source: 'discord-capture',
        })
        createPlanMock.mockResolvedValue({
            runId: 'run-1',
            desired: {
                version: 1,
                guild: { id: '123456789012345678', name: 'Criativaria' },
                source: 'manual',
            },
            plan: {
                operations: [],
                protectedOperations: [],
                summary: {
                    total: 0,
                    safe: 0,
                    protected: 0,
                },
            },
        })
        getStatusMock.mockResolvedValue({
            manifest: {
                guildId: '123456789012345678',
                version: 1,
                updatedAt: new Date(),
                lastCapturedAt: new Date(),
            },
            latestRun: {
                id: 'run-1',
                type: 'plan',
                status: 'completed',
                createdAt: new Date(),
            },
            drifts: [],
        })
        listRunsMock.mockResolvedValue([])
        recordCaptureMock.mockResolvedValue({ runId: 'run-capture' })
        runCutoverMock.mockResolvedValue({
            runId: 'run-cutover',
            status: 'completed',
            checklistComplete: true,
        })
        updateRunStatusMock.mockResolvedValue(undefined)
        applyAutomationModulesMock.mockResolvedValue({
            appliedModules: ['onboarding'],
            skippedModules: [],
        })
    })

    it('exposes required subcommands', () => {
        const names = guildconfigCommand.data.options.map((option: any) => option.name)

        expect(names).toEqual(
            expect.arrayContaining([
                'capture',
                'plan',
                'apply',
                'reconcile',
                'status',
                'cutover',
            ]),
        )
    })

    it('captures guild state on capture subcommand', async () => {
        const interaction = createInteraction('capture')

        await guildconfigCommand.execute({ interaction } as any)

        expect(captureGuildAutomationStateMock).toHaveBeenCalled()
        expect(recordCaptureMock).toHaveBeenCalledWith(
            '123456789012345678',
            expect.any(Object),
            '888888888888888888',
        )
        expect(interaction.editReply).toHaveBeenCalled()
    })

    it('builds plan from current capture', async () => {
        const interaction = createInteraction('plan')

        await guildconfigCommand.execute({ interaction } as any)

        expect(createPlanMock).toHaveBeenCalledWith('123456789012345678', {
            actualState: expect.any(Object),
            initiatedBy: '888888888888888888',
            runType: 'plan',
        })
    })

    it('applies modules for apply subcommand when no protected ops', async () => {
        const interaction = createInteraction('apply', { allow_protected: false })

        await guildconfigCommand.execute({ interaction } as any)

        expect(applyAutomationModulesMock).toHaveBeenCalled()
        expect(updateRunStatusMock).toHaveBeenCalledWith(
            expect.objectContaining({
                runId: 'run-1',
                status: 'completed',
            }),
        )
    })
})
