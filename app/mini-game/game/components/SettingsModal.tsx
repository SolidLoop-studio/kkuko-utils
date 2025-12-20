"use client";
import React, { useEffect, useState } from 'react';
import { soundManager } from '../lib/SoundManager';

interface Props {
    onClose: () => void;
}

const SettingsModal = ({ onClose }: Props) => {
    const [volume, setVolume] = useState(100);

    useEffect(() => {
        try {
            const v = localStorage.getItem('kkutuVolume');
            if (v !== null) setVolume(Number(v));
        } catch (e) { }
    }, []);

    const handleChange = (v: number) => {
        setVolume(v);
        try {
            soundManager.setAllVolume(v / 100);
        } catch (e) { }
    };

    const handleSave = () => {
        try {
            localStorage.setItem('kkutuVolume', String(volume));
        } catch (e) { }
        try {
            soundManager.setAllVolume(volume / 100);
        } catch (e) { }
        onClose();
    };

    return (
        <div className="fixed inset-0 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-[480px] p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">설정</h3>
                    <button onClick={onClose} className="text-gray-500">×</button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-700 mb-2">효과음/배경음 볼륨</label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={volume}
                            onChange={(e) => handleChange(Number(e.target.value))}
                            className="w-full"
                        />
                        <div className="text-sm text-gray-600 mt-1">{volume}%</div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2 rounded">저장</button>
                        <button onClick={onClose} className="flex-1 bg-gray-300 text-gray-800 py-2 rounded">취소</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;