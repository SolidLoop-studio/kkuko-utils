import React from 'react';
import { render, screen } from '@testing-library/react';
import ProfileAvatar from '@/src/app/kkuko/shared/components/ProfileAvatar';
import { ItemInfo, ProfileData } from '@/src/app/types/kkuko.types';

jest.mock('@/app/kkuko/shared/components/TryRenderImg', () => {
    return function MockTryRenderImg(props: any) {
        return <img alt={props.alt} src={props.src} data-testid="avatar-layer" />;
    };
});

describe('ProfileAvatar', () => {
    const mockProfileData: ProfileData = {
        equipment: [
            { itemId: 'item1', slot: 'head' },
            { itemId: 'item2', slot: 'hairdeco' },
        ],
    } as any;

    const mockItemsData: ItemInfo[] = [
        { id: 'item1', name: 'Cool Hat', image: 'hat.png' },
        { id: 'item2', name: 'Ribbon', image: 'ribbon.png' },
    ] as any;

    it('should render avatar layers', () => {
        render(<ProfileAvatar profileData={mockProfileData} itemsData={mockItemsData} />);
        
        // Check if layers are rendered
        // Note: The logic in ProfileAvatar groups items by slot and renders them in order.
        // We mock TryRenderImg so we expect to see images.
        const layers = screen.getAllByTestId('avatar-layer');
        expect(layers.length).toBeGreaterThan(0);
    });
});
