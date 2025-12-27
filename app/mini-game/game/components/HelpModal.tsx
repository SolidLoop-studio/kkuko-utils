"use client";
import React from 'react';

interface Props { onClose: () => void }

const HelpModal = ({ onClose }: Props) => {
    return (
        <div className="fixed inset-0 backdrop-blur-md bg-white/30 dark:bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl w-[90%] max-w-[700px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 border-b border-blue-100 dark:border-gray-700">
                    <h3 className="text-2xl font-bold text-blue-900 dark:text-gray-100 flex items-center gap-2">
                        📖 도움말
                    </h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-300 hover:text-gray-700 text-3xl transition-colors leading-none">&times;</button>
                </div>
                <div className="overflow-y-auto px-6 py-4 text-sm text-gray-700 dark:text-gray-200 space-y-4">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-800 p-4 rounded-xl border border-green-200 dark:border-green-700 shadow-sm">
                        <h4 className="font-bold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2 text-base">
                            🎮 게임시작 관련
                        </h4>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-200 ml-2">
                            <li>단어리스트를 txt파일을 이용하여 업로드 합니다. <span className="text-xs text-gray-600 dark:text-gray-400">(주의사항: 단어는 한줄에 하나씩, 1mb이하 / 팁: 단어는 한번 업로드 시 로컬에 저장되어 재방문 시 유지됩니다. 단어 목록 조회버튼으로 단어를 관리할 수 있습니다)</span></li>
                            <li>자신이 원하는 대로 모드를 수정합니다. <span className="text-xs text-gray-600 dark:text-gray-400">(팁: 설정도 로컬에 저장되어 재방문 시 유지됩니다)</span></li>
                            <li>위에 있는 시작 버튼을 누르거나 채팅창에서 <strong className="text-green-700 dark:text-green-300">/시작</strong>, <strong className="text-green-700 dark:text-green-300">/ㄱ</strong>, <strong className="text-green-700 dark:text-green-300">/r</strong> 을 입력하여 시작할 수 있습니다.</li>
                        </ul>
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 p-4 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm">
                        <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2 text-base">
                            ⚙️ 설정 관련
                        </h4>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-200 ml-2">
                            <li><strong className="text-blue-700 dark:text-blue-300">라운드 시간:</strong> 라운드 시간을 설정합니다. 라운드 시간과 턴시간은 관련이 있지만 같지는 않습니다. 무제한으로 설정 시 턴시간도 무제한이 됩니다.</li>
                            <li><strong className="text-blue-700 dark:text-blue-300">언어:</strong> 선택된 언어의 단어와 미션단어가 나옵니다.</li>
                            <li><strong className="text-blue-700 dark:text-blue-300">모드:</strong> 일반 선택 시 시작글자에 맞으면서 단어 목록에 있으면 되지만, 미션을 선택 시에는 입력된 단어에 반드시 제시된 미션글자가 있어야 하며 단어 목록에도 있어야 합니다.</li>
                            <li><strong className="text-blue-700 dark:text-blue-300">힌트 모드:</strong> 게임중 또는 게임후 표시될 힌트모드를 선택합니다. 특수 선택 시에는 일반모드면 제시된 첫글자에 맞으면서 가장 긴단어, 미션 모드면 미션글자가 가장 많이 포함되면서 가장 긴단어를 힌트로 알려주고 랜덤모드는 허용되는 단어 중 랜덤으로 1개를 알려줍니다.</li>
                            <li><strong className="text-blue-700 dark:text-blue-300">이전에 나온 글자 미표시:</strong> 게임중 한번 나왔던 글자는 해당 게임중 다시 등장하지 않습니다. 하지만 해당 글자들 외에 가능한 글자가 없다면 무시됩니다.</li>
                            <li><strong className="text-blue-700 dark:text-blue-300">제시어 설정:</strong> 게임중 제시되는 글자를 원하는 것으로 설정합니다. 공백없이 글자들을 나열해야 합니다. 해당 글자로 시작하는 단어들이 없으면 무시됩니다.</li>
                        </ul>
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-700 dark:to-gray-800 p-4 rounded-xl border border-purple-200 dark:border-purple-700 shadow-sm">
                        <h4 className="font-bold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2 text-base">
                            🎯 게임중/종료 관련
                        </h4>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-200 ml-2">
                            <li>게임 시작후 나오는 시작글자에 맞춰 업로드한 파일에 있는 단어를 입력하면 됩니다.</li>
                            <li>미션 모드에서는 미션글자가 들어가야 올바른 단어로 허용합니다.</li>
                            <li><strong className="text-purple-700 dark:text-purple-300">/ㅈㅈ</strong> 또는 <strong className="text-purple-700 dark:text-purple-300">/gg</strong>를 활용하여 게임을 즉시 종료할 수 있습니다.</li>
                            <li>게임중 <strong className="text-purple-700 dark:text-purple-300">/v</strong> 또는 <strong className="text-purple-700 dark:text-purple-300">/ㅍ</strong>를 입력하여 힌트를 볼 수 있습니다.</li>
                            <li>힌트를 요청 시 해당 시작글자에 대해 처음 요청이면 초성만, 2번째면 1/3은 공개 나머지는 초성, 3번째는 절반, 4번째는 2/3, 5번째는 전체를 공개합니다.</li>
                            <li>게임 종료 시 사용했던 단어들을 알려주며 게임후 다시 확인하여 복습할 수 있습니다.</li>
                            <li>게임 종료후 채팅창에 <strong className="text-purple-700 dark:text-purple-300">/r</strong>, <strong className="text-purple-700 dark:text-purple-300">/ㄱ</strong>으로 게임을 나가지 않고 같은 설정으로 다시 시작할 수 있습니다.</li>
                        </ul>
                    </div>

                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-gray-700 dark:to-gray-800 p-4 rounded-xl border border-amber-200 dark:border-amber-700 shadow-sm">
                        <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2 text-base">
                            💡 기타 도움말
                        </h4>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-200 ml-2">
                            <li>올리는 단어들은 모두 정규화(공백문자, 특수문자 등을 제거)되어 저장되며, 텍스트 파일을 업로드하여 단어가 저장된 경우 주제는 모두 &lt;자유&gt;로 설정됩니다.</li>
                            <li>설정 버튼을 통해 소리의 크기를 변경할 수 있습니다.</li>
                            <li>사전 버튼을 통해 단어가 만들어진 DB에 존재하는지 확인할 수 있습니다.</li>
                        </ul>
                    </div>
                </div>
                <div className="p-6 pt-4 border-t border-blue-100 dark:border-gray-700">
                    <button onClick={onClose} className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-gray-700 dark:to-gray-800 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold shadow-md transition-all duration-200 hover:shadow-lg">닫기</button>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;