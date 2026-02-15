export interface UserProfile {
    id: string;
    nickname: string;
    exp: number;
    observedAt: string;
    exordial: string;
    level: number;
    isPublic: boolean;
    isLastOnlineHidden: boolean;
}

export interface Equipment {
    userId: string;
    slot: string;
    itemId: string;
}

export interface KkukoRecord {
    id: string;
    userId: string;
    modeId: string;
    total: number;
    win: number;
    exp: number;
    playtime: number;
}

export interface Presence {
    userId: string;
    channelId: string | null;
    roomId: string | null;
    crawlerId: string;
    updatedAt: string | null;
}

export interface ProfileData {
    user: UserProfile;
    equipment: Equipment[];
    record: KkukoRecord[];
    presence: Presence;
}

export interface ItemOption {
    gEXP?: number;
    hEXP?: number;
    gMNY?: number;
    hMNY?: number;
    [key: string]: number | undefined;
};

export interface SpecialOptions{
    date: number;
    after: ItemOption;
    before: ItemOption;
}

export interface ItemInfo {
    id: string;
    name: string;
    description: string;
    updatedAt: number;
    group: string;
    options: ItemOption | SpecialOptions;
}

export interface Mode {
    modeId: string;
    modeName: string;
    group: string;
}

export interface RankingEntry {
    rank: number;
    userRecord: {
        id: number;
        userId: string;
        modeId: string;
        total: number;
        win: number;
        exp: number;
        playtime: number;
    };
    userInfo: {
        id: string;
        nickname: string;
        exp: number;
        observedAt: string;
        exordial: string;
        level: number;
    };
}

export type RankingOption = 'win' | 'exp' | 'total';

export function isSpecialOptions(obj: unknown): obj is SpecialOptions {
    return !!obj && typeof obj === 'object' &&
        'date' in obj && typeof obj.date === 'number' &&
        'after' in obj && typeof obj.after === 'object' &&
        'before' in obj && typeof obj.before === 'object';
}