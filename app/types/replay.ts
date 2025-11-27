type Player = {
    /* 플레이어 데이터 */
    data: PlayerData;
    /* 플레이어 착용 의상 */
    equip: PlayerEquip;
    /* 플레이어 고유id */
    id?: string;
    /* 플레이어 닉네임 (이유는 모르나 #으로 시작함) */
    nick: string;
    score: number;
}

type PlayerData = {
    connectDate: number;
    event_addon: boolean;
    event_xmas: number;
    eventcount: number;
    eventdate: number;
    fbactive: boolean;
    fbdictcounts: number;
    fbdictdate: number;
    fbremains: number;
    fbrewards: boolean;
    /* 닉네임 바꾼 시각 */
    nickchangetime: number;
    playTime: number;
    /* 플레이어 게임모드 기록, 키: 게임모드 코드, [게임수, 승리수, ?, ?] */
    record: { [key: string]: [number, number, number, number] }
    /* 플레이어 경험치 */
    score: number;
}

type PlayerEquip = {
    BDG?: string;
    Mavatar?: string;
    Mback?: string;
    Mclothes?: string;
    Mdressdeco?: string;
    Meye?: string;
    Meyedeco?: string;
    Mfacedeco?: string;
    Mhairdeco?: string;
    Mhead?: string;
    Mlhand?: string;
    Mmouth?: string;
    NIK?: string;
}

type GameOpts = {
    /* 중도입장 금지 */
    donotjoinduringgame: boolean;
    /* 에티켓 */
    etiquette: boolean;
    /* 젠틀 */
    gentle: boolean;
    /* 어인정 */
    injeong: boolean;
    /* 선택된주제 (단대 | 자퀴)만 비어있지 않음 */
    injpick: string[];
    /* 우리말 */
    loanword: boolean;
    /* 매너 */
    manner: boolean;
    /* 미션 */
    mission: boolean;
    /* 두글자 금지 (솎솎) */
    no2: boolean;
    noleave: boolean;
    /* 새내기 */
    onlybeginner: boolean;
    /* 속담 (타대) */
    proverb: boolean;
    /* 3232 (쿵따) */
    sami: boolean;
    /* 깐깐 */
    strict: boolean;
    wordmaxlen: boolean;
}

type GameEventProfile = {
    id: string;
    title: string;
}

type GameEventData = |
{
    type: "conn";
    user: {
        data: { score: number }
        equip: PlayerEquip;
        id?: string;
        profile: GameEventProfile
    };
} |
{
    type: "disconn";
    id?: string;
} |
{
    type: "roundReady";
    profile: GameEventProfile;
    char: string;
    mission: string | null;
    round: number;
} | {
    type: "turnStart";
    char: string;
    mission: string | null;
    id?: string;
    profile: GameEventProfile;
    roundTime: number;
    turnTime: number;
    speed: number;
    turn: number;
} | {
    type: "turnEnd";
    value: string;
    bonus: number;
    score: number;
    ok: true;
    profile: GameEventProfile;
    theme: string;
    mean: string;
    wc: string;
} | {
    type: "turnEnd";
    hint: string;
    bonus: null;
    score: number;
    ok: false;
    profile: GameEventProfile;
    target: string;
} | {
    type: "updateScore";
    target: string;
    score: number;
    profile: GameEventProfile;
} | {
    type: "turnError";
    value: string;
    code: number;
    profile: GameEventProfile;
} | {
    type: "chat";
    code: string | null;
    data: string | null;
    from: string;
    to: string;
    value: string;
} | {
    type: "disconnRoom";
    id?: string;
} | {
    type: "okg";
    count: number;
    time: number;
}

type RoundReadyBase = Extract<GameEventData, { type: "roundReady" }>;

// 모드별 확장 타입들
type GameEventDataMode6 = Omit<RoundReadyBase, "char" | "mission"> & {
    type: "roundReady";
    list: string[];
    profile: GameEventProfile;
    round: number;
}

type GameEventDataMode13 = Omit<RoundReadyBase, "char" | "mission"> & {
    type: "roundReady";
    round: number;
    profile: GameEventProfile;
    board: string;
}

type GameEventDataMode11 = (Omit<RoundReadyBase, "char" | "turnEnd"> & {
    type: "roundReady";
    round: number;
    profile: GameEventProfile;
    mission: string | null;
    theme: string;
} |
{
    type: "turnEnd";
    value: string;
    bonus: number;
    score: number;
    ok: true;
    theme: string;
    mean: string;
    wc: string;
}) | Exclude<GameEventData, { type: "roundReady" | "turnEnd" }>;

type GameEventDataMode4 = ({
    type: "roundReady";
    profile: GameEventProfile;
    round: number;
    theme: string;
} | {
    type: "turnStart";
    profile: GameEventProfile;
    roundTime: number;
    char: string;
} | {
    type: "turnHint";
    profile: GameEventProfile;
    hint: string;
} | {
    type: "turnEnd";
    answer: string;
    profile: GameEventProfile;
    bonus: number | null;
    score: number | null;
}) | Exclude<GameEventData, { type: "roundReady" | "turnStart" | "turnEnd" }>;

export const mode = {
    0: "영끄",
    1: "영끝",
    2: "쿵따",
    3: "한끝",
    4: "자퀴",
    5: "십자말",
    6: "한타대",
    7: "영타대",
    8: "한앞말",
    9: "영앞말",
    10: "훈민",
    11: "한단대",
    12: "영단대",
    13: "한솎",
    14: "영솎",
    15: "그퀴",
    16: "OX"
}

type ReplayBase<TEvent> = {
    /* 게임 이벤트 */
    events: { data: TEvent; time: number }[];
    /* 게임 옵션 */
    opts: GameOpts;
    /* 플레이어 정보 */
    players: Player[];
    /* 방입장 수 인원 제한 */
    limit: number;
    /* 자신 id */
    me: string;
    /* 라운드 수 */
    round: number;
    /* 각 라운드 제한 시간 */
    roundTime: number;
    time: number;
    /* 방제목 */
    title: string;
    /* 리플레이 파일 버전 */
    version: string;
};


export type ReplayData =
    | (ReplayBase<GameEventData> & {
        /* 모드 - 일반 */
        mode: 0 | 1 | 2 | 3 | 4 | 5 | 7 | 8 | 9 | 10 | 12 | 14 | 15 | 16;
    })
    | (ReplayBase<GameEventDataMode6> & {
        /* 모드 - 6 전용 */
        mode: 6;
    })
    | (ReplayBase<GameEventDataMode13> & {
        /* 모드 - 13 전용 */
        mode: 13;
    })
    | (ReplayBase<GameEventDataMode11> & {
        /* 모드 - 11 전용 */
        mode: 11;
    })
    | (ReplayBase<GameEventDataMode4> & {
        /* 모드 - 4 전용 */
        mode: 4;
    })


export const errorCode: { [key: number]: string } = {
    402: "시작한방",
    403: "한방",
    404: "없는 단어",
    405: "외래어",
    406: "깐깐",
    407: "다른주제",
    409: "이미 사용한 단어",
    410: "젠틀"
}

export type GameEventType = GameEventData['type'] | 'startGame';