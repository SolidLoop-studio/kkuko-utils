import React from 'react';
import HelpModal from '@/app/components/HelpModal';

const WordSearchHelpModal = () => {
    return (
        <HelpModal title="단어 고급 검색 도움말" showIcon={true}>
            <div className="space-y-4">
                <section>
                    <h3 className="font-semibold text-base mb-2 text-gray-800 dark:text-gray-100">🎮 검색 모드</h3>
                    <ul className="space-y-2 ml-4">
                        <li>
                            <strong>한국어 끝말잇기:</strong> 시작 글자로 시작하는 단어를 검색합니다.
                        </li>
                        <li>
                            <strong>한국어 앞말잇기:</strong> 끝 글자로 끝나는 단어를 검색합니다.
                        </li>
                        <li>
                            <strong>쿵쿵따:</strong> 3글자 단어를 검색합니다. 시작/끝 글자를 최대 3글자까지 입력할 수 있습니다.
                        </li>
                        <li>
                            <strong>훈민정음:</strong> 정확히 2글자 자음을 입력하여 해당 자음인 단어를 검색합니다.
                        </li>
                        <li>
                            <strong>자음퀴즈:</strong> 자음을 입력하여 해당 자음으로 시작하는 단어를 검색합니다. 주제를 선택해야 검색할 수 있습니다.
                        </li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-semibold text-base mb-2 text-gray-800 dark:text-gray-100">⚙️ 검색 옵션 (끝말잇기/앞말잇기/쿵쿵따)</h3>
                    <ul className="space-y-2 ml-4">
                        <li>
                            <strong>시작/끝 글자:</strong> 검색할 단어의 첫/마지막 글자를 지정합니다.
                        </li>
                        <li>
                            <strong>미션 글자:</strong> 단어에 반드시 포함되어야 할 글자를 입력합니다. 여러 글자 입력 가능.
                        </li>
                        <li>
                            <strong>최소/최대 글자수:</strong> 검색할 단어의 길이 범위를 지정합니다. (2-100글자)
                        </li>
                        <li>
                            <strong>표시 개수:</strong> 검색 결과로 표시할 최대 단어 수를 설정합니다. -1을 입력하면 제한 없음.
                        </li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-semibold text-base mb-2 text-gray-800 dark:text-gray-100">📊 정렬 및 필터</h3>
                    <ul className="space-y-2 ml-4">
                        <li>
                            <strong>가나다순:</strong> 단어를 가나다 순으로 정렬합니다.
                        </li>
                        <li>
                            <strong>길이순:</strong> 단어 길이를 기준으로 정렬합니다.
                        </li>
                        <li>
                            <strong>공격단어순:</strong> 후속 단어가 적은 순서대로 정렬합니다. (공격적인 단어 우선)
                        </li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-semibold text-base mb-2 text-gray-800 dark:text-gray-100">✅ 체크 옵션</h3>
                    <ul className="space-y-2 ml-4">
                        <li>
                            <strong>두음법칙:</strong> 두음법칙을 적용하여 검색합니다. (예: 리 → 이, 녀 → 여)
                        </li>
                        <li>
                            <strong>간단 정보:</strong> 각 단어의 길이, 미션 글자 포함 개수, 후속 단어 수를 표시합니다.
                        </li>
                        <li>
                            <strong>어인정:</strong> 어인정 단어를 허용합니다.
                        </li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-semibold text-base mb-2 text-gray-800 dark:text-gray-100">🎯 매너 모드</h3>
                    <ul className="space-y-2 ml-4">
                        <li>
                            <strong>없음:</strong> 한방 단어를 표시합니다.
                        </li>
                        <li>
                            <strong>매너:</strong> 한방 단어를 표시 하지 않습니다.
                        </li>
                        <li>
                            <strong>젠틀:</strong> 후속단어 수가 5개 미만인 단어를 표시 하지 않습니다.
                        </li>
                        <li>
                            <strong>에티켓:</strong> 노인정을 기준으로 한방 글자를 산정한 한방단어를 표시하지 않습니다.
                        </li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-semibold text-base mb-2 text-gray-800 dark:text-gray-100">🏷️ 주제 선택 (자음퀴즈)</h3>
                    <ul className="space-y-2 ml-4">
                        <li>
                            자음퀴즈 모드에서는 반드시 주제를 선택해야 검색할 수 있습니다.
                        </li>
                        <li>
                            <strong>노인정 주제:</strong> 구표준국어대사전에 있던 주제들입니다.
                        </li>
                        <li>
                            <strong>어인정 주제:</strong> 끄투코리아에서 추가한 주제들입니다.
                        </li>
                        <li>
                            주제 검색 기능을 사용하여 원하는 주제를 빠르게 찾을 수 있습니다.
                        </li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-semibold text-base mb-2 text-gray-800 dark:text-gray-100">💡 검색 결과</h3>
                    <ul className="space-y-2 ml-4">
                        <li>
                            <strong>미션 글자 하이라이트:</strong> 미션 글자가 입력된 경우, 결과에서 해당 글자가 <span className="text-lime-500 font-bold">연두색</span>으로 표시됩니다.
                        </li>
                        <li>
                            <strong>결과 다운로드:</strong> 검색 결과를 텍스트 파일로 다운로드할 수 있습니다.
                        </li>
                        <li>
                            <strong>상세보기:</strong> 각 단어를 클릭하면 단어의 상세 정보를 확인할 수 있습니다.
                        </li>
                    </ul>
                </section>

                <section>
                    <h3 className="font-semibold text-base mb-2 text-gray-800 dark:text-gray-100">⌨️ 단축키</h3>
                    <ul className="space-y-2 ml-4">
                        <li>
                            <strong>Enter:</strong> 입력 필드에서 Enter 키를 눌러 빠르게 검색할 수 있습니다.
                        </li>
                    </ul>
                </section>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡 <strong>팁:</strong> 공격단어순 정렬을 사용하면 상대방이 대응하기 어려운 단어를 찾을 수 있습니다!
                    </p>
                </div>
            </div>
        </HelpModal>
    );
};

export default WordSearchHelpModal;
