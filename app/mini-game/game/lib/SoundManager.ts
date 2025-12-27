import { Howl } from "howler";

/**
 * 사운드 관리를 위한 클래스
 * Howler.js를 사용하여 오디오 리소스를 로드하고 재생합니다.
 * Singleton 패턴을 사용하여 인스턴스를 관리합니다.
 */
class SoundManager {
    private static instance: SoundManager;
    private sounds: Record<string, Howl> = {};
    private lastPlayed: Record<string, number> = {};

    private constructor() {
        // Singleton
    }

    /**
     * SoundManager의 인스턴스를 반환합니다.
     */
    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    /**
     * 모든 사운드 리소스를 로드합니다.
     * 게임 시작 시 호출되어야 합니다.
     */
    public load() {
        // BGM 및 효과음 로드
        for (let i = 0; i <= 10; i++) {
            this.sounds[`T${i}`] = new Howl({
                src: [`/audio/bgm/T${i}.mp3`],
                volume: 1.0,
            });
            this.sounds[`As${i}`] = new Howl({
                src: [`/audio/in_game/As${i}.mp3`],
                volume: 1.0,
            });
            this.sounds[`K${i}`] = new Howl({
                src: [`/audio/in_game/K${i}.mp3`],
                volume: 1.0,
            });
        }
        
        const commonSounds = [
            { key: "Al", path: "/audio/in_game/Al.mp3" },
            { key: "mission", path: "/audio/in_game/mission.mp3" },
            { key: "fail", path: "/audio/in_game/fail.mp3" },
            { key: "timeout", path: "/audio/in_game/timeout.mp3" },
            { key: "game_start", path: "/audio/game/game_start.mp3" },
            { key: "round_start", path: "/audio/game/round_start.mp3" },
        ];

        commonSounds.forEach(({ key, path }) => {
            this.sounds[key] = new Howl({
                src: [path],
                volume: 1.0,
            });
        });

        this.sounds["jaqwiBGM"] = new Howl({
            src: ["/audio/bgm/JaqwiBGM.mp3"],
            volume: 1.0,
            loop: true,
        });
    }

    /**
     * 특정 사운드를 재생합니다.
     * 이미 재생 중인 경우 중지하고 처음부터 다시 재생합니다.
     * @param soundName 재생할 사운드 이름
     */
    public play(soundName: string) {
        this.stop(soundName);
        this.sounds[soundName]?.play();
    }

    /**
     * 특정 사운드를 최소 간격을 두고 재생합니다.
     * 너무 빈번한 재생을 방지할 때 사용합니다.
     * @param soundName 재생할 사운드 이름
     * @param minGapMs 최소 재생 간격 (ms)
     */
    public playOnce(soundName: string, minGapMs = 80) {
        const now = Date.now();
        const last = this.lastPlayed[soundName] || 0;
        if (now - last < minGapMs) return;
        this.lastPlayed[soundName] = now;
        this.play(soundName);
    }

    /**
     * 사운드를 재생하고 완료 시 콜백을 실행합니다.
     * @param soundName 재생할 사운드 이름
     * @param cb 재생 완료 후 실행할 콜백 함수
     */
    public playWithEnd(soundName: string, cb?: () => void) {
        this.stop(soundName);
        const s = this.sounds[soundName];
        if (!s) return;
        
        // 기존 이벤트 리스너 제거 (중복 실행 방지)
        s.off('end');
        
        s.once('end', () => {
            if (cb) cb();
        });
        s.play();
    }

    /**
     * 특정 사운드 재생을 중지합니다.
     * @param soundName 중지할 사운드 이름
     */
    public stop(soundName: string) {
        this.sounds[soundName]?.stop();
    }

    /**
     * 특정 사운드의 볼륨을 조절합니다.
     * @param soundName 사운드 이름
     * @param volume 볼륨 (0.0 ~ 1.0)
     */
    public setVolume(soundName: string, volume: number) {
        this.sounds[soundName]?.volume(volume);
    }

    /**
     * 모든 사운드의 볼륨을 일괄 설정합니다.
     * @param volume 0.0 ~ 1.0
     */
    public setAllVolume(volume: number) {
        Object.values(this.sounds).forEach((s) => {
            s.volume(volume);
        });
    }

    /**
     * 모든 사운드를 중지합니다.
     */
    public stopAllSounds() {
        Object.values(this.sounds).forEach((s) => {
            s.stop();
        });
    }
}

export const soundManager = SoundManager.getInstance();