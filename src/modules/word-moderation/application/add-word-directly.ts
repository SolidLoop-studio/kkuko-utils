import { err, type Result } from '@/src/shared/application/result';
import { normalizeDirectWordAdditionCommand, type DirectWordAdditionNoInjungPolicy } from '../domain/direct-word-addition';
import type { DirectWordAdditionGateway } from './direct-word-addition-ports';
import type { DirectWordAdditionCommand, DirectWordAdditionResult } from './direct-word-addition-types';

const infrastructureError = () => ({
    kind: 'infrastructure' as const,
    message: '단어 추가 처리 중 오류가 발생했습니다.',
});

/** 직접 단어 추가 입력을 검증하고 하나의 원자적 gateway 명령으로 전달합니다. */
export class AddWordDirectlyService {
    constructor(
        private readonly gateway: DirectWordAdditionGateway,
        private readonly isNoin: DirectWordAdditionNoInjungPolicy,
    ) {}

    async add(command: DirectWordAdditionCommand): Promise<Result<DirectWordAdditionResult>> {
        const normalized = normalizeDirectWordAdditionCommand(command, this.isNoin);
        if (!normalized.ok) return normalized;

        const result = await this.gateway.add({
            word: normalized.value.word,
            themeCodes: normalized.value.themeCodes,
        });
        if (!result.ok) return result;

        return result.value.word === normalized.value.word
            && result.value.noinCanUse === normalized.value.noinCanUse
            ? result
            : err(infrastructureError());
    }
}
