import React, { useMemo, useState } from 'react';
import { ItemInfo, ProfileData } from '@/src/app/types/kkuko.types';
import TryRenderImg from './TryRenderImg';

interface ProfileAvatarProps {
    profileData: ProfileData;
    itemsData: ItemInfo[];
}

export default function ProfileAvatar({ profileData, itemsData }: ProfileAvatarProps) {
    const [imgLoadedCount, setImgLoadedCount] = useState(0);

    const characterLayers = useMemo(() => {
        if (!profileData) return [];

        const layerOrder = ['back', 'avatar', 'eye', 'mouth', 'facedeco', 'eyedeco', 'shoes', 'clothes', 'dressdeco', 'head', 'hairdeco', 'hand', 'front', 'badge'];
        
        // Group items by their slot for proper identification
        const itemsBySlot: Record<string, ItemInfo> = {};
        const currentItems = itemsData || [];

        profileData.equipment.forEach(equipment => {
            if (equipment.slot === 'NIK') return;
            const item = currentItems.find(i => i.id === equipment.itemId);
            if (!item) return;
            if (equipment.slot === 'BDG') itemsBySlot['badge'] = item;
            else itemsBySlot[equipment.slot] = item;
        });

        // Render layers in order
        const layers: { key: string; url: string; alt: string; className?: string }[] = [];
        
        layerOrder.forEach((group, index) => {
            // Check for left hand and right hand separately if group is 'hand'
            if (group === 'hand') {
                // Render left hand (Mlhand)
                const leftHandItem = itemsBySlot['Mlhand'];
                if (leftHandItem) {
                    const imageName = leftHandItem.id;
                    const imageUrl = `https://cdn.kkutu.co.kr/img/kkutu/moremi/hand/${imageName}.png`;
                    
                    layers.push({
                        key: `hand-left-${index}`,
                        url: imageUrl,
                        alt: "left hand layer",
                        className: "transition-opacity duration-300"
                    });
                }
                
                // Render right hand (Mrhand)
                const rightHandItem = itemsBySlot['Mrhand'];
                if (rightHandItem) {
                    const imageName = rightHandItem.id;
                    const imageUrl = `https://cdn.kkutu.co.kr/img/kkutu/moremi/hand/${imageName}.png`;
                    
                    layers.push({
                        key: `hand-right-${index}`,
                        url: imageUrl,
                        alt: "right hand layer",
                        className: "transition-opacity duration-300 scale-x-[-1]"
                    });
                }
            } else {
                // For other groups, check with M prefix
                const slotKey = `M${group}`;
                const item = itemsBySlot[slotKey] || itemsBySlot[group];
                
                if (item) {
                    const imageName = item.name === 'def' ? 'def' : item.id;
                    const imageUrl = `https://cdn.kkutu.co.kr/img/kkutu/moremi/${group}/${imageName}.png`;

                    layers.push({
                        key: `${group}-${index}`,
                        url: imageUrl,
                        alt: `${group} layer`,
                        className: "transition-opacity duration-300"
                    });
                } else if (group !== 'badge' && item === undefined) {
                    const itemId = 'def';
                    const imageUrl = `https://cdn.kkutu.co.kr/img/kkutu/moremi/${group}/${itemId}.png`;
                    layers.push({
                        key: `${group}-${index}`,
                        url: imageUrl,
                        alt: `${group} default layer`,
                        className: "transition-opacity duration-300"
                    });
                }
            }
        });
        
        return layers;
    }, [profileData, itemsData]);

    return (
        <div className="relative w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            {imgLoadedCount < characterLayers.length && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            )}
            {characterLayers.map((layer) => (
                <div
                    key={layer.key}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <TryRenderImg
                        placeholder={<div className="w-48 h-48" />}
                        url={layer.url}
                        alt={layer.alt}
                        width={192}
                        height={192}
                        className={layer.className}
                        hanldeLoad={() => setImgLoadedCount(prev => prev + 1)}
                        onFailure={() => setImgLoadedCount(prev => prev + 1)}
                    />
                </div>
            ))}
        </div>
    );
}
