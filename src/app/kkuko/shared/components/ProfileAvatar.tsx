import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { ItemInfo, ProfileData } from '@/src/app/types/kkuko.types';
import TryRenderImg from './TryRenderImg';

interface ProfileAvatarProps {
    profileData: ProfileData;
    itemsData: ItemInfo[];
}

export default function ProfileAvatar({ profileData, itemsData }: ProfileAvatarProps) {
    const [imgLoadedCount, setImgLoadedCount] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        try {
            setIsDownloading(true);
            const canvas = document.createElement('canvas');
            canvas.width = 192;
            canvas.height = 192;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 배경 그리기
            ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#374151' : '#f3f4f6';
            ctx.fillRect(0, 0, 192, 192);

            // 이미지 소스 수집 및 그리기
            const imageUrls = characterLayers.map(layer => ({
                url: `https://img-proxy.jtw7913.workers.dev?v=3&url=${layer.url}`,
                flip: layer.className?.includes('scale-x-[-1]') || false
            }));

            for (const item of imageUrls) {
                const img = new Image();
                img.crossOrigin = 'anonymous'; // CORS 문제 방지
                
                await new Promise((resolve) => {
                    img.onload = () => {
                        if (item.flip) {
                            ctx.save();
                            ctx.scale(-1, 1);
                            ctx.drawImage(img, -192, 0, 192, 192);
                            ctx.restore();
                        } else {
                            ctx.drawImage(img, 0, 0, 192, 192);
                        }
                        resolve(null);
                    };
                    img.onerror = () => resolve(null); // 에러 발생 시 무시하고 진행
                
                    img.src = item.url 
                });
            }

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${profileData.user.nickname}_avatar.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading avatar:', error);
            alert('아바타 이미지 다운로드에 실패했습니다.');
        } finally {
            setIsDownloading(false);
        }
    };

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
        <div className="relative group w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
            {imgLoadedCount < characterLayers.length && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            )}
            {characterLayers.map((layer) => (
                <div
                    key={layer.key}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
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
            
            {/* Download Button */}
            {imgLoadedCount >= characterLayers.length && (
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={`absolute bottom-2 right-2 p-2 rounded-full bg-white/80 dark:bg-black/60 shadow-sm backdrop-blur-sm text-gray-700 dark:text-gray-200 transition-all z-30
                        ${isDownloading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-black hover:scale-105 opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                    title="아바타 이미지 다운로드"
                    aria-label="Download avatar"
                >
                    {isDownloading ? (
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Download className="w-5 h-5" />
                    )}
                </button>
            )}
        </div>
    );
}
