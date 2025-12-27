import { soundManager } from '@/app/mini-game/game/lib/SoundManager';
import { Howl } from 'howler';

jest.mock('howler');

describe('SoundManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Ensure sounds are loaded for each test if needed, or just once.
        // Since soundManager is a singleton, we might want to reset it or just call load() again.
        // The load method overwrites properties in `sounds` object, so calling it again is fine.
    });

    it('should load sounds correctly', () => {
        soundManager.load();
        expect(Howl).toHaveBeenCalled();
        const sounds = (soundManager as any).sounds;
        expect(Object.keys(sounds).length).toBeGreaterThan(0);
    });

    it('should play a sound', () => {
        soundManager.load();
        const soundName = 'game_start';
        soundManager.play(soundName);
        
        const sounds = (soundManager as any).sounds;
        expect(sounds[soundName]).toBeDefined();
        expect(sounds[soundName].stop).toHaveBeenCalled();
        expect(sounds[soundName].play).toHaveBeenCalled();
    });

    it('should playOnce correctly', () => {
        soundManager.load();
        const soundName = 'fail';
        const sounds = (soundManager as any).sounds;
        
        // Mock Date.now
        let now = 1000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);

        // First play
        soundManager.playOnce(soundName);
        expect(sounds[soundName].play).toHaveBeenCalledTimes(1);
        
        // Immediate second play (should be ignored)
        now += 10; // +10ms
        soundManager.playOnce(soundName);
        expect(sounds[soundName].play).toHaveBeenCalledTimes(1);
        
        // Play after delay
        now += 100; // +100ms (total 110ms > 80ms)
        soundManager.playOnce(soundName);
        expect(sounds[soundName].play).toHaveBeenCalledTimes(2);
        
        jest.restoreAllMocks();
    });

    it('should stop a sound', () => {
        soundManager.load();
        const soundName = 'game_start';
        soundManager.stop(soundName);
        const sounds = (soundManager as any).sounds;
        expect(sounds[soundName].stop).toHaveBeenCalled();
    });

    it('should set volume', () => {
        soundManager.load();
        const soundName = 'game_start';
        soundManager.setVolume(soundName, 0.5);
        const sounds = (soundManager as any).sounds;
        expect(sounds[soundName].volume).toHaveBeenCalledWith(0.5);
    });

    it('should set all volume', () => {
        soundManager.load();
        soundManager.setAllVolume(0.5);
        const sounds = (soundManager as any).sounds;
        Object.values(sounds).forEach((s: any) => {
            expect(s.volume).toHaveBeenCalledWith(0.5);
        });
    });

    it('should stop all sounds', () => {
        soundManager.load();
        soundManager.stopAllSounds();
        const sounds = (soundManager as any).sounds;
        Object.values(sounds).forEach((s: any) => {
            expect(s.stop).toHaveBeenCalled();
        });
    });

    it('should playWithEnd and trigger callback', () => {
        soundManager.load();
        const soundName = 'game_start';
        const cb = jest.fn();
        soundManager.playWithEnd(soundName, cb);
        
        const sounds = (soundManager as any).sounds;
        expect(sounds[soundName].play).toHaveBeenCalled();
        expect(sounds[soundName].once).toHaveBeenCalledWith('end', expect.any(Function));
        
        // Manually trigger the callback
        const call = sounds[soundName].once.mock.calls.find((c: any) => c[0] === 'end');
        if (call) {
            call[1](); // Execute the callback passed to 'once'
        }
        expect(cb).toHaveBeenCalled();
    });
});