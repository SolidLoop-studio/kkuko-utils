import type { ReplayData, GameEventType } from "@/types/replay";
import { errorCode, mode } from "@/types/replay";

type ParserError = {
    name: string;
    message: string;
    stacktrace?: string;
    errorString?: string;
}

type ReturnModeParse = {
    words: string[];
    wordAndThemes: { [key: string]: string[] };
    logs: { type: GameEventType | "turnHint"; time: number; userId?: string; message: string; }[];
    roundChains: { round: number; chains: { userId: string; word: string | null; isRoundEnd: boolean }[] }[];
    userMapping: { [userId: string]: number };
    mode: number;
}

export default class ReplayParser {
    private rowData: string;
    private parsedData: ReplayData | null = null;

    constructor(data: string) {
        this.rowData = data;
    }

    public parse() {
        try {
            const jsonData = JSON.parse(this.rowData) as ReplayData;
            this.parsedData = jsonData;
            return { data: jsonData, error: null }
        } catch (error) {
            const perror: ParserError = {
                name: "파일이 손상되었거나 올바르지 않은 데이터 입니다.",
                message: error instanceof Error ? error.message : "",
                stacktrace: error instanceof Error ? error.stack : new Error().stack,
                errorString: error instanceof Error ? error.toString() : JSON.stringify(error)
            };
            return { data: null, error: perror }
        }
    }

    public analyzeByMode(): { data: ReturnModeParse, error: null } | { data: null, error: ParserError } {
        if (!this.parsedData) return { data: null, error: { name: "NotParsedError", message: "Replay data is not parsed yet." } };
        if (this.parsedData.mode === 4) {
            return this.jaquizModeAnalyze();
        } else if (![6,11,13].includes(this.parsedData.mode)) {
            return this.normalModeAnalyze();
        } else if (this.parsedData.mode === 11) {
            return this.handandaeModeAnalyze();
        }
        return { data: null, error: { name: "UnsupportedModeError", message: "This mode is not supported yet." } };
    }

    private normalModeAnalyze(): { data: ReturnModeParse, error: null } | { data: null, error: ParserError } {
        if (!this.parsedData) return { data: null, error: { name: "NotParsedError", message: "Replay data is not parsed yet." } };
        if (this.parsedData.mode === 4 || this.parsedData.mode === 11) return { data: null, error: { name: "InvalidModeError", message: "Replay data is not in normal mode." } };

        const words: string[] = [];
        const wordAndThemes: { [key: string]: string[] } = {};
        const logs: { type: GameEventType; time: number; userId?: string; message: string; }[] = [];
        const roundChains: { round: number; chains: { userId: string; word: string | null; isRoundEnd: boolean }[] }[] = [];
        const userMapping: { [userId: string]: number } = {};
        const userOrder: string[] = [];
        let currentRound = -1;
        let currentChain: { userId: string; word: string | null; isRoundEnd: boolean }[] = [];

        logs.push({
            type: 'startGame', 
            time: 0, 
            userId: "", 
            message: `방제: ${this.parsedData.title} (${this.parsedData.round}라운드, ${this.parsedData.roundTime}초, 최대인원 ${this.parsedData.limit}명, 모드: ${mode[this.parsedData.mode] ?? "알 수 없음"})`
        });

        for (const event of this.parsedData.events) {
            const eventData = event.data;
            
            switch (eventData.type) {
                case "chat":
                    logs.push({ type: "chat", time: event.time, userId: eventData.from, message: eventData.value });
                    break;
                case "conn":
                    logs.push({ type: "conn", time: event.time, userId: eventData.user.profile?.id, message: `${eventData.user.profile?.id}님이 입장하셨습니다.` });
                    break;
                case "disconn":
                    logs.push({ type: "disconn", time: event.time, userId: eventData?.id, message: `${eventData?.id}님이 퇴장하셨습니다.` });
                    break;
                case "disconnRoom":
                    logs.push({ type: "disconnRoom", time: event.time, userId: eventData?.id, message: `${eventData?.id}님이 퇴장하셨습니다.` });
                    break;
                case "roundReady":
                    if (!("char" in eventData) || !("mission" in eventData)) continue;
                    logs.push({ type: "roundReady", time: event.time, userId: eventData.profile?.id, message: `${eventData.round}라운드 준비. 시작 글자: ${eventData.char}${eventData.mission ? `, 미션글자: ${eventData.mission}` : ""}` });
                    if (currentChain.length > 0) {
                        roundChains.push({ round: currentRound, chains: currentChain });
                    }
                    currentRound = eventData.round;
                    currentChain = [];
                    break;
                case "turnStart":
                    if (!("mission" in eventData)) continue;
                    logs.push({ type: "turnStart", time: event.time, userId: eventData.profile?.id, message: `시작글자: ${eventData.char}${eventData.mission ? `, 미션글자: ${eventData.mission}` : ""}로 턴 시작` });
                    break;
                case "turnEnd":
                    // 명시적 타입 가드 사용
                    if ("ok" in eventData) {
                        const userId = eventData.profile?.id || "";
                        // 첫 번째 라운드에서 유저 순서 기록
                        if (currentRound === 1 && userId && !userOrder.includes(userId)) {
                            userOrder.push(userId);
                            userMapping[userId] = userOrder.length;
                        }
                        
                        if (eventData.ok) {
                            words.push(eventData.value);
                            wordAndThemes[eventData.value] = [...new Set(eventData.theme.split(","))];
                            logs.push({ type: "turnEnd", time: event.time, userId: eventData.profile?.id, message: `"${eventData.value}"입력 성공. 얻은 점수: ${eventData.score}점 (미션 보너스: ${eventData.bonus ? eventData.bonus + "점" : "없음"})` });
                            currentChain.push({ userId: eventData.profile?.id, word: eventData.value, isRoundEnd: false });
                        } else {
                            if (!eventData.hint) continue;
                            words.push(eventData.hint);
                            logs.push({ type: "turnEnd", time: event.time, userId: eventData.profile?.id, message: `라운드 종료. 힌트: ${eventData.hint}. 잃은 점수: ${Math.abs(eventData.score)}점` });
                            currentChain.push({ userId: eventData.profile?.id, word: null, isRoundEnd: true });
                        }
                    }
                    break;
                case "turnError":
                    logs.push({ type: "turnError", time: event.time, userId: eventData.profile?.id, message: `턴 넘기기 실패. 입력한 단어: ${eventData.value}, 에러코드: ${eventData.code} (${errorCode[eventData.code] ?? "알 수 없는 에러"})` });
                    break;
            }
        }

        if (currentChain.length > 0) {
            roundChains.push({ round: currentRound, chains: currentChain });
        }

        return { data: { words: [...new Set(words)], wordAndThemes, logs, roundChains, userMapping, mode: this.parsedData.mode }, error: null };
    }

    private jaquizModeAnalyze(): { data: ReturnModeParse, error: null } | { data: null, error: ParserError } {
        if (!this.parsedData) return { data: null, error: { name: "NotParsedError", message: "Replay data is not parsed yet." } };
        if (this.parsedData.mode !== 4) return { data: null, error: { name: "InvalidModeError", message: "Replay data is not in jaquiz mode." } };

        const words: string[] = [];
        const wordAndThemes: { [key: string]: string[] } = {};
        const logs: { type: GameEventType | "turnHint"; time: number; userId?: string; message: string; }[] = [];
        const roundChains: { round: number; chains: { userId: string; word: string | null; isRoundEnd: boolean }[] }[] = [];
        let currentRound = -1;
        let currentChain: { userId: string; word: string | null; isRoundEnd: boolean }[] = [];

        logs.push({
            type: 'startGame', 
            time: 0, 
            userId: "", 
            message: `방제: ${this.parsedData.title} (${this.parsedData.round}라운드, ${this.parsedData.roundTime}초, 최대인원 ${this.parsedData.limit}명, 모드: ${mode[this.parsedData.mode] ?? "알 수 없음"})`
        });

        for (const event of this.parsedData.events) {
            const eventData = event.data;
            
            switch (eventData.type) {
                case "chat":
                    logs.push({ type: "chat", time: event.time, userId: eventData.from, message: eventData.value });
                    break;
                case "conn":
                    logs.push({ type: "conn", time: event.time, userId: eventData.user.profile.id, message: `${eventData.user.profile.id}님이 입장하셨습니다.` });
                    break;
                case "disconn":
                    logs.push({ type: "disconn", time: event.time, userId: eventData.id, message: `${eventData.id}님이 퇴장하셨습니다.` });
                    break;
                case "disconnRoom":
                    logs.push({ type: "disconnRoom", time: event.time, userId: eventData.id, message: `${eventData.id}님이 퇴장하셨습니다.` });
                    break;
                case "roundReady":
                    // Mode4에서는 roundReady의 구조가 다름
                    if ("theme" in eventData) {
                        logs.push({ type: "roundReady", time: event.time, userId: eventData.profile.id, message: `${eventData.round}라운드 준비. 주제: ${eventData.theme}` });
                        if (currentChain.length > 0) {
                            roundChains.push({ round: currentRound, chains: currentChain });
                        }
                        currentRound = eventData.round;
                        currentChain = [];
                    }
                    break;
                case "turnStart":
                    // Mode4에서는 turnStart의 구조가 다름
                    if ("char" in eventData) {
                        logs.push({ type: "turnStart", time: event.time, userId: eventData.profile.id, message: `자음: ${eventData.char}` });
                    }
                    break;
                case "turnHint":
                    // Mode4 전용 이벤트
                    if ("hint" in eventData) {
                        logs.push({ type: "turnHint", time: event.time, userId: eventData.profile.id, message: `힌트: ${eventData.hint}` });
                    }
                    break;
                case "turnEnd":
                    // Mode4에서는 turnEnd의 구조가 다름
                    if ("answer" in eventData) {
                        words.push(eventData.answer);
                        logs.push({ type: "turnEnd", time: event.time, userId: eventData.profile.id, message: `정답: ${eventData.answer}. ${eventData.score ? `얻은 점수: ${eventData.score}점` : ""} ${eventData.bonus ? `(보너스: ${eventData.bonus}점)` : ""}` });
                        currentChain.push({ userId: eventData.profile.id, word: eventData.answer, isRoundEnd: false });
                    }
                    break;
                case "turnError":
                    logs.push({ type: "turnError", time: event.time, userId: eventData.profile.id, message: `턴 넘기기 실패. 입력한 단어: ${eventData.value}, 에러코드: ${eventData.code} (${errorCode[eventData.code] ?? "알 수 없는 에러"})` });
                    break;
            }
        }

        if (currentChain.length > 0) {
            roundChains.push({ round: currentRound, chains: currentChain });
        }

        return { data: { words: [...new Set(words)], wordAndThemes, logs, roundChains, userMapping: {}, mode: this.parsedData.mode }, error: null };
    }

    private handandaeModeAnalyze(): { data: ReturnModeParse, error: null} | { data: null, error: ParserError} {
        if (!this.parsedData) return { data: null, error: { name: "NotParsedError", message: "Replay data is not parsed yet." } };
        if (this.parsedData.mode !== 11) return { data: null, error: { name: "InvalidModeError", message: "Replay data is not in handandae mode." } };

        const words: string[] = [];
        const wordAndThemes: { [key: string]: string[] } = {};
        const logs: { type: GameEventType; time: number; userId?: string; message: string; }[] = [];
        const roundChains: { round: number; chains: { userId: string; word: string | null; isRoundEnd: boolean }[] }[] = [];
        let currentRound = -1;
        let currentChain: { userId: string; word: string | null; isRoundEnd: boolean }[] = [];

        logs.push({
            type: 'startGame',
            time: 0,
            userId: "",
            message: `방제: ${this.parsedData.title} (${this.parsedData.round}라운드, ${this.parsedData.roundTime}초, 최대인원 ${this.parsedData.limit}명, 모드: ${mode[this.parsedData.mode] ?? "알 수 없음"})`
        });

        for (const event of this.parsedData.events) {
            const eventData = event.data;

            switch (eventData.type) {
                case "chat":
                    logs.push({ type: "chat", time: event.time, userId: eventData.from, message: eventData.value });
                    break;
                case "conn":
                    logs.push({ type: "conn", time: event.time, userId: eventData.user.profile.id, message: `${eventData.user.profile.id}님이 입장하셨습니다.` });
                    break;
                case "disconn":
                    logs.push({ type: "disconn", time: event.time, userId: eventData.id, message: `${eventData.id}님이 퇴장하셨습니다.` });
                    break;
                case "disconnRoom":
                    logs.push({ type: "disconnRoom", time: event.time, userId: eventData.id, message: `${eventData.id}님이 퇴장하셨습니다.` });
                    break;
                case "roundReady":
                    // Mode5에서는 roundReady의 구조가 다름
                    if ("theme" in eventData) {
                        logs.push({ type: "roundReady", time: event.time, userId: eventData.profile.id, message: `${eventData.round}라운드 준비. 주제: ${eventData.theme}` });
                        if (currentChain.length > 0) {
                            roundChains.push({ round: currentRound, chains: currentChain });
                        }
                        currentRound = eventData.round;
                        currentChain = [];
                    }
                    break;
                case "turnStart":
                    // Mode5에서는 turnStart의 구조가 다름
                    if ("char" in eventData) {
                        logs.push({ type: "turnStart", time: event.time, userId: eventData.profile.id, message: `시작글자: ${eventData.char}로 턴 시작` });
                    }
                    break;
                 case "turnEnd":
                    // 명시적 타입 가드 사용
                    if ("ok" in eventData) {
                        if (eventData.ok) {
                            words.push(eventData.value);
                            wordAndThemes[eventData.value] = [...new Set(eventData.theme.split(","))];
                            logs.push({ type: "turnEnd", time: event.time, userId: "", message: `"${eventData.value}"입력 성공. 얻은 점수: ${eventData.score}점 (미션 보너스: ${eventData.bonus ? eventData.bonus + "점" : "없음"})` });
                            currentChain.push({ userId: "", word: eventData.value, isRoundEnd: false });
                        } else {
                            currentChain.push({ userId: "", word: null, isRoundEnd: true });
                        }
                    }
                    break;
                case "turnError":
                    logs.push({ type: "turnError", time: event.time, userId: eventData.profile.id, message: `턴 넘기기 실패. 입력한 단어: ${eventData.value}, 에러코드: ${eventData.code} (${errorCode[eventData.code] ?? "알 수 없는 에러"})` });
                    break;
            }
        }

        if (currentChain.length > 0) {
            roundChains.push({ round: currentRound, chains: currentChain });
        }

        return { data: { words: [...new Set(words)], wordAndThemes, logs, roundChains, userMapping: {}, mode: this.parsedData.mode }, error: null };
    }
}