import type { Result } from '@/src/shared/application/result';
import type {
    DirectWordAdditionGatewayCommand,
    DirectWordAdditionResult,
} from './direct-word-addition-types';

export interface DirectWordAdditionGateway {
    add(command: DirectWordAdditionGatewayCommand): Promise<Result<DirectWordAdditionResult>>;
}
