import { Server } from 'socket.io';
import { MatchmakingService } from './matchmakingService';
import { BattleService } from './battleService';
export declare function setupSocketHandlers(io: Server): Promise<void>;
export declare function getMatchmakingService(): MatchmakingService | null;
export declare function getBattleService(): BattleService | null;
export declare function cleanupSocketServices(): Promise<void>;
//# sourceMappingURL=socketService.d.ts.map