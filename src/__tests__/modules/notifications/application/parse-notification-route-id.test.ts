import { parseNotificationRouteId } from '@/src/modules/notifications/application/parse-notification-route-id';

describe('parseNotificationRouteId', () => {
    it.each(['1', '17', String(Number.MAX_SAFE_INTEGER)])(
        'accepts the canonical positive decimal id %s',
        (value) => {
            expect(parseNotificationRouteId(value)).toBe(Number(value));
        },
    );

    it.each([
        '',
        '0',
        '-1',
        '01',
        '1.0',
        '1.5',
        '1e2',
        '0x10',
        '+1',
        ' 1',
        '1 ',
        '12abc',
        String(Number.MAX_SAFE_INTEGER + 1),
    ])('rejects the non-canonical or unsafe id %s', (value) => {
        expect(parseNotificationRouteId(value)).toBeNull();
    });
});
