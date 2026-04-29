import { NotificationService } from '@/src/lib/services/application/notification/NotificationService';
import type { INotificationRepository, IStorageRepository } from '@/src/lib/services/domain/notification/NotificationRepository';
import type { NotificationEntity, NewNotification, UpdateNotification } from '@/src/lib/services/domain/notification/NotificationEntity';
import { success, failure } from '@/src/lib/services/domain/result';
import { infrastructureError } from '@/src/lib/services/domain/errors';

const mockNotification: NotificationEntity = {
    id: 1,
    title: '공지',
    body: '내용입니다',
    img: null,
    endAt: '2099-12-31',
    isImportant: false,
    isModal: true,
    createdAt: '2024-01-01',
};

function makeMockNotificationRepo(
    overrides: Partial<INotificationRepository> = {}
): INotificationRepository {
    return {
        findAll: jest.fn().mockResolvedValue(success([mockNotification])),
        findById: jest.fn().mockResolvedValue(success(mockNotification)),
        findActiveModal: jest.fn().mockResolvedValue(success(mockNotification)),
        save: jest.fn().mockResolvedValue(success(mockNotification)),
        update: jest.fn().mockResolvedValue(success(mockNotification)),
        deleteById: jest.fn().mockResolvedValue(success(undefined)),
        ...overrides,
    };
}

function makeMockStorageRepo(overrides: Partial<IStorageRepository> = {}): IStorageRepository {
    return {
        uploadImage: jest.fn().mockResolvedValue(success('https://example.com/img.png')),
        deleteImage: jest.fn().mockResolvedValue(success(undefined)),
        getPublicUrl: jest.fn().mockReturnValue('https://example.com/img.png'),
        ...overrides,
    };
}

describe('NotificationService', () => {
    describe('getActiveModal', () => {
        it('활성 모달 공지 반환', async () => {
            const service = new NotificationService(makeMockNotificationRepo(), makeMockStorageRepo());
            const result = await service.getActiveModal();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data?.isModal).toBe(true);
        });

        it('활성 공지 없으면 null 반환', async () => {
            const repo = makeMockNotificationRepo({ findActiveModal: jest.fn().mockResolvedValue(success(null)) });
            const service = new NotificationService(repo, makeMockStorageRepo());
            const result = await service.getActiveModal();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBeNull();
        });
    });

    describe('getAll', () => {
        it('전체 공지 목록 반환', async () => {
            const service = new NotificationService(makeMockNotificationRepo(), makeMockStorageRepo());
            const result = await service.getAll();
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toHaveLength(1);
        });
    });

    describe('getById', () => {
        it('ID로 공지 반환', async () => {
            const service = new NotificationService(makeMockNotificationRepo(), makeMockStorageRepo());
            const result = await service.getById(1);
            expect(result.success).toBe(true);
            if (result.success) expect(result.data?.id).toBe(1);
        });

        it('존재하지 않는 공지는 null 반환', async () => {
            const repo = makeMockNotificationRepo({ findById: jest.fn().mockResolvedValue(success(null)) });
            const service = new NotificationService(repo, makeMockStorageRepo());
            const result = await service.getById(999);
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBeNull();
        });
    });

    describe('create', () => {
        it('새 공지 생성 성공', async () => {
            const repo = makeMockNotificationRepo();
            const service = new NotificationService(repo, makeMockStorageRepo());
            const newNotif: NewNotification = { title: '공지', body: '내용', endAt: '2099-12-31' };
            const result = await service.create(newNotif);
            expect(result.success).toBe(true);
            expect(repo.save).toHaveBeenCalledWith(newNotif);
        });
    });

    describe('update', () => {
        it('공지 수정 성공', async () => {
            const repo = makeMockNotificationRepo();
            const service = new NotificationService(repo, makeMockStorageRepo());
            const updateData: UpdateNotification = { title: '변경', endAt: '2099-12-31' };
            const result = await service.update(1, updateData);
            expect(result.success).toBe(true);
            expect(repo.update).toHaveBeenCalledWith(1, updateData);
        });

        it('인프라 에러 전달', async () => {
            const err = infrastructureError({ message: 'DB error' });
            const repo = makeMockNotificationRepo({ update: jest.fn().mockResolvedValue(failure(err)) });
            const service = new NotificationService(repo, makeMockStorageRepo());
            const result = await service.update(1, { endAt: '2099-12-31' });
            expect(result.success).toBe(false);
        });
    });

    describe('deleteById', () => {
        it('공지 삭제 성공', async () => {
            const repo = makeMockNotificationRepo();
            const service = new NotificationService(repo, makeMockStorageRepo());
            const result = await service.deleteById(1);
            expect(result.success).toBe(true);
            expect(repo.deleteById).toHaveBeenCalledWith(1);
        });
    });

    describe('uploadImage', () => {
        it('이미지 업로드 성공 — URL 반환', async () => {
            const storageRepo = makeMockStorageRepo();
            const service = new NotificationService(makeMockNotificationRepo(), storageRepo);
            const file = new File(['content'], 'test.png', { type: 'image/png' });
            const result = await service.uploadImage(file, 'notifications/test.png');
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBe('https://example.com/img.png');
        });
    });

    describe('deleteImage', () => {
        it('이미지 삭제 성공', async () => {
            const storageRepo = makeMockStorageRepo();
            const service = new NotificationService(makeMockNotificationRepo(), storageRepo);
            const result = await service.deleteImage('notifications/test.png');
            expect(result.success).toBe(true);
        });
    });

    describe('getPublicUrl', () => {
        it('공개 URL 반환', () => {
            const storageRepo = makeMockStorageRepo();
            const service = new NotificationService(makeMockNotificationRepo(), storageRepo);
            const url = service.getPublicUrl('notifications/test.png');
            expect(url).toBe('https://example.com/img.png');
        });
    });
});
