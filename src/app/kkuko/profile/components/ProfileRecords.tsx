import React from 'react';
import { ProfileData, Mode } from '@/src/app/types/kkuko.types';
import { groupRecordsByMode, getModeName, calculateWinRate } from '../utils/profileHelper';

interface ProfileRecordsProps {
    profileData: ProfileData;
    modesData: Mode[];
}

export default function ProfileRecords({ profileData, modesData }: ProfileRecordsProps) {
    const recordsByMode = groupRecordsByMode(profileData.record, modesData);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">전적</h3>
            <div className="space-y-6">
                {Object.entries(recordsByMode).map(([groupName, records]) => (
                    records.length > 0 && (
                        <div key={groupName}>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 capitalize">
                                {groupName === 'kor' ? '한국어' : groupName === 'eng' ? '영어' : '이벤트'}
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-3 px-4 text-gray-900 dark:text-gray-100">모드</th>
                                            <th className="text-right py-3 px-4 text-gray-900 dark:text-gray-100">총 게임</th>
                                            <th className="text-right py-3 px-4 text-gray-900 dark:text-gray-100">승리</th>
                                            <th className="text-right py-3 px-4 text-gray-900 dark:text-gray-100">승률</th>
                                            <th className="text-right py-3 px-4 text-gray-900 dark:text-gray-100">경험치</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {records.map((rec) => (
                                            <tr key={rec.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                                <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{getModeName(rec.modeId, modesData)}</td>
                                                <td className="text-right py-3 px-4 text-gray-900 dark:text-gray-100">{rec.total.toLocaleString()}</td>
                                                <td className="text-right py-3 px-4 text-gray-900 dark:text-gray-100">{rec.win.toLocaleString()}</td>
                                                <td className="text-right py-3 px-4 text-gray-900 dark:text-gray-100">{calculateWinRate(rec.win, rec.total)}%</td>
                                                <td className="text-right py-3 px-4 text-gray-900 dark:text-gray-100">{rec.exp.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
}
