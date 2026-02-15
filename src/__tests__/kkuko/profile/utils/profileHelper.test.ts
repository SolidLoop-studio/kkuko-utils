// __tests__/kkuko/profile/utils/profileHelper.test.ts
import {
    getNicknameColor,
    extractColorFromLabel,
    formatNumber,
    calculateTotalOptions,
    getModeName,
    getModeGroup,
    groupRecordsByMode,
    calculateWinRate,
    formatObservedAt,
    getSlotName,
    getOptionName,
    formatLastSeen,
    parseDescription
} from '@/src/app/kkuko/profile/utils/profileHelper';
import { Equipment, ItemInfo, Mode, KkukoRecord } from '@/src/app/types/kkuko.types';
import { NICKNAME_COLORS, SLOT_NAMES, OPTION_NAMES } from '@/src/app/kkuko/shared/lib/const';

describe('profileHelper', () => {

    describe('getNicknameColor', () => {
        const isDarkTheme = false;
        const equipment: Equipment[] = [
            { itemId: 'normal_item', slot: 'Mhead', userId: 'user1' },
            { itemId: 'red_name', slot: 'NIK', userId: 'user1' }
        ];

        it('should return correct color for NIK slot', () => {
            const color = getNicknameColor(equipment, isDarkTheme);
            expect(color).toBe(NICKNAME_COLORS['red']);
        });

        it('should return default color if no NIK slot', () => {
            const color = getNicknameColor([], isDarkTheme);
            expect(color).toBe('#000000');
        });

        it('should return white default for dark theme', () => {
             const color = getNicknameColor([], true);
             expect(color).toBe('#FFFFFF');
        });

        it('should return default color if color key not found', () => {
             const badEquip: Equipment[] = [{ userId: 'user1', itemId: 'unknown_color', slot: 'NIK' }];
             const color = getNicknameColor(badEquip, false);
             expect(color).toBe('#000000');
        });
    });

    describe('extractColorFromLabel', () => {
        it('should extract color from label', () => {
            const desc = "<label class='x-blue_name'>Some Text</label>";
            const color = extractColorFromLabel(desc, false);
            expect(color).toBe(NICKNAME_COLORS['blue']);
        });

        it('should return default if no match', () => {
            const desc = "Simple text";
            const color = extractColorFromLabel(desc, false);
            expect(color).toBe('#000000');
        });
    });

    describe('formatNumber', () => {
        it('should return string', () => {
             expect(formatNumber(0.014999999)).toBe('0.015');
             expect(formatNumber(0.12)).toBe('0.12');
        });
    });

    describe('calculateTotalOptions', () => {
        it('should calculate totals correctly for normal options', () => {
            const items: ItemInfo[] = [
                { id: '1', name: 'Item1', description: '', group: '', options: { str: 1, dex: 2 }, updatedAt: 1 },
                { id: '2', name: 'Item2', description: '', group: '', options: { str: 3 }, updatedAt: 1 }
            ];
            const result = calculateTotalOptions(items);
            // 1 * 1 + 3 * 1 = 4
            expect(result['str']).toBe(4);
            expect(result['dex']).toBe(2);
        });

        it('should handle special options', () => {
            const now = Date.now();
            const items: ItemInfo[] = [
                {
                    id: '3', name: 'Special', description: '', group: '',
                    options: {
                        date: now - 10000, // Past
                        before: { str: 1 },
                        after: { str: 5 }
                    }, updatedAt: 1
                }
            ];
            const result = calculateTotalOptions(items);
            // Should use 'after'
            expect(result['str']).toBe(5);
        });
        
         it('should handle special options (before)', () => {
            const now = Date.now();
            const items: ItemInfo[] = [
                {
                    id: '3', name: 'Special', description: '', group: '',
                    options: {
                        date: now + 10000, // Future
                        before: { str: 1 },
                        after: { str: 5 }
                    }, updatedAt: 1
                }
            ];
            const result = calculateTotalOptions(items);
            // Should use 'before'
            expect(result['str']).toBe(1);
        });
    });

    describe('getModeName & getModeGroup', () => {
        const modes: Mode[] = [
             { modeId: 'm1', modeName: 'Mode 1', group: 'kor' },
             { modeId: 'm2', modeName: 'Mode 2', group: 'eng' }
        ];

        it('should return mode name', () => {
            expect(getModeName('m1', modes)).toBe('Mode 1');
            expect(getModeName('unknown', modes)).toBe('unknown');
        });

        it('should return mode group', () => {
            expect(getModeGroup('m1', modes)).toBe('kor');
            expect(getModeGroup('unknown', modes)).toBe('unknown');
        });
    });

     describe('groupRecordsByMode', () => {
        const modes: Mode[] = [
             { modeId: 'm1', modeName: 'Mode 1', group: 'kor' },
             { modeId: 'm2', modeName: 'Mode 2', group: 'eng' },
             { modeId: 'm3', modeName: 'Mode 3', group: 'event' }
        ];
        const records: KkukoRecord[] = [
            { modeId: 'm1', win: 10, lose: 5, draw: 0 },
            { modeId: 'm2', win: 20, lose: 5, draw: 0 },
            { modeId: 'm3', win: 5, lose: 5, draw: 0 },
            { modeId: 'm1', win: 1, lose: 1, draw: 0 }
        ] as any;

        it('should group records', () => {
            const grouped = groupRecordsByMode(records, modes);
            expect(grouped['kor']).toHaveLength(2);
            expect(grouped['eng']).toHaveLength(1);
            expect(grouped['event']).toHaveLength(1);
        });
    });

    describe('calculateWinRate', () => {
        it('should calculate win rate', () => {
            expect(calculateWinRate(50, 100)).toBe('50.00');
            expect(calculateWinRate(1, 3)).toBe('33.33');
            expect(calculateWinRate(0, 0)).toBe('0.00');
        });
    });

    describe('formatObservedAt', () => {
        it('should format date', () => {
            const dateStr = '2023-01-01T12:00:00.000Z';
            const formatted = formatObservedAt(dateStr);
            // This might depend on locale, checking for basic structure or parts
            expect(formatted).toContain('2023');
            expect(formatted).toContain('01');
        });
    });
    
    describe('formatLastSeen', () => {
        it('should format days ago', () => {
             const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
             expect(formatLastSeen(twoDaysAgo)).toBe('2일 전');
        });
         it('should format hours ago', () => {
             const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
             expect(formatLastSeen(twoHoursAgo)).toBe('2시간 전');
        });
         it('should format minutes ago', () => {
             const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
             expect(formatLastSeen(twoMinutesAgo)).toBe('2분 전');
        });
    });

    describe('parseDescription', () => {
        it('should parse description with colors', () => {
             const desc = "Hello <label class='x-red_name'>World</label>!";
             const parts = parseDescription(desc);
             expect(parts).toHaveLength(3);
             expect(parts[0].text).toBe('Hello ');
             expect(parts[1].text).toBe('World');
             expect(parts[1].colorKey).toBe('red');
             expect(parts[2].text).toBe('!');
        });
        
         it('should parse plain text', () => {
             const parts = parseDescription("Hello World");
             expect(parts).toHaveLength(1);
             expect(parts[0].text).toBe("Hello World");
        });
    });

    describe('getSlotName & getOptionName', () => {
         it('should get slot name', () => {
             expect(getSlotName('NIK')).toBe(SLOT_NAMES['NIK']);
             expect(getSlotName('Unknown')).toBe('Unknown');
         });
         it('should get option name', () => {
             expect(getOptionName('gEXP')).toBe(OPTION_NAMES['gEXP']);
             expect(getOptionName('Unknown')).toBe('Unknown');
         });
    });

});
