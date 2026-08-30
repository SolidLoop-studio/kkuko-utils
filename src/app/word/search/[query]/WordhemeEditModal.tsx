import React, { useState } from "react";
import { X, ChevronDown, ChevronUp, Users, Book, Save } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/src/app/components/ui/dialog";
import { Button } from "@/src/app/components/ui/button";
import { Badge } from "@/src/app/components/ui/badge";
import { Checkbox } from "@/src/app/components/ui/checkbox";
import ConfirmModal from "@/src/app/components/ConfirmModal";

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    wordInfo: WordInfoProps;
    onSave: (newThemes: string[], delThemes: string[]) => Promise<void>;
    injungTheme: string[];
    noInjungTheme: string[];
    isSaving: boolean;
}

interface AccordionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}

interface WordInfoProps {
    word: string;
    topic: {
        ok: string[];
        waitAdd: string[];
        waitDel: string[];
    };
}

const Accordion = ({ title, icon, children }: AccordionProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md mb-4">
            <button
                className="flex items-center justify-between w-full p-4 text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-md text-gray-900 dark:text-gray-100"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-medium">{title}</span>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {isOpen && <div className="p-4 bg-white dark:bg-gray-900">{children}</div>}
        </div>
    );
};

const WordThemeEditModal = ({ isOpen, onClose, wordInfo, onSave, injungTheme, noInjungTheme, isSaving }: EditModalProps) => {
    // 선택된 주제들을 관리하는 상태
    const [selectedSeniorTopics, setSelectedSeniorTopics] = useState<string[]>(
        // 초기값: ok 상태인 주제 중 노인정 주제에 해당하는 것들
        wordInfo.topic.ok.filter(topic =>
            noInjungTheme.includes(topic)
        )
    );

    const [selectedYouthTopics, setSelectedYouthTopics] = useState<string[]>(
        // 초기값: ok 상태인 주제 중 어인정 주제에 해당하는 것들
        wordInfo.topic.ok.filter(topic =>
            injungTheme.includes(topic)
        )
    );
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);

    // 주제 선택 가능 여부 확인 함수
    const isTopicInteractable = (topic: string) => {
        // 추가/삭제 요청 상태인 주제는 선택 불가능
        return !wordInfo.topic.waitAdd.includes(topic) && !wordInfo.topic.waitDel.includes(topic);
    };

    // 주제 선택/해제 핸들러
    const handleTopicToggle = (topic: string) => {
        // 추가/삭제 요청 상태의 주제는 선택 불가능
        if (!isTopicInteractable(topic)) return;

        if (noInjungTheme.includes(topic)) {
            if (selectedSeniorTopics.includes(topic)) {
                setSelectedSeniorTopics(prev => prev.filter(t => t !== topic));
            } else {
                setSelectedSeniorTopics(prev => [...prev, topic]);
            }
        } else {
            if (selectedYouthTopics.includes(topic)) {
                setSelectedYouthTopics(prev => prev.filter(t => t !== topic));
            } else {
                setSelectedYouthTopics(prev => [...prev, topic]);
            }
        }
    };

    // 저장 핸들러
    const handleSave = async () => {
        if (isSaving) return;

        const newThemes: string[] = [];
        for (const topic of selectedSeniorTopics) {
            if (!wordInfo.topic.ok.includes(topic)) {
                newThemes.push(topic);
            }
        }
        for (const topic of selectedYouthTopics) {
            if (!wordInfo.topic.ok.includes(topic)) {
                newThemes.push(topic);
            }
        }
        const delThemes: string[] = [];
        for (const topic of wordInfo.topic.ok) {
            if (!selectedSeniorTopics.includes(topic) && !selectedYouthTopics.includes(topic)) {
                delThemes.push(topic);
            }
        }

        await onSave(newThemes, delThemes);
        onClose();
    };

    // 주제 상태에 따른 배지 스타일 결정
    const getTopicBadgeStyle = (topic: string) => {
        if (wordInfo.topic.ok.includes(topic)) {
            return "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800";
        } else if (wordInfo.topic.waitAdd.includes(topic)) {
            return "bg-blue-100 text-blue-800 border-dashed border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-600";
        } else if (wordInfo.topic.waitDel.includes(topic)) {
            return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-600";
        } else {
            return "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl overflow-y-auto max-h-[90vh] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            &quot;{wordInfo.word}&quot; 주제 수정
                        </span>

                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        이 단어에 적용할 주제를 선택해 주세요. 변경사항은 관리자 검토 후 반영됩니다.
                    </p>

                    {/* 선택된 주제 미리보기 */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                            선택된 주제 ({selectedSeniorTopics.length + selectedYouthTopics.length})
                        </h3>
                        <div className="flex flex-wrap gap-2 min-h-10 p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                            {selectedSeniorTopics.concat(selectedYouthTopics).length > 0 ? (
                                selectedSeniorTopics.concat(selectedYouthTopics).map(topic => (
                                    <Badge
                                        key={`selected-${topic}`}
                                        variant="secondary"
                                        className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 pl-2 pr-1 py-1 flex items-center gap-1"
                                    >
                                        {topic}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-4 w-4 rounded-full ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200"
                                            onClick={() => handleTopicToggle(topic)}
                                        >
                                            <X size={10} />
                                        </Button>
                                    </Badge>
                                ))
                            ) : (
                                <p className="text-gray-400 dark:text-gray-500 text-sm p-1">선택된 주제가 없습니다.</p>
                            )}
                        </div>
                    </div>

                    {/* 노인정 주제 아코디언 */}
                    <Accordion
                        title={`노인정 주제 (${selectedSeniorTopics.length}/${noInjungTheme.length})`}
                        icon={<Users size={18} className="text-blue-600 dark:text-blue-400" />}
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {noInjungTheme.map(topic => {
                                const isWaitState = wordInfo.topic.waitAdd.includes(topic) || wordInfo.topic.waitDel.includes(topic);

                                return (
                                    <div
                                        key={`senior-${topic}`}
                                        className="flex items-center space-x-2"
                                    >
                                        <Checkbox
                                            id={`senior-${topic}`}
                                            checked={selectedSeniorTopics.includes(topic)}
                                            onCheckedChange={() => handleTopicToggle(topic)}
                                            disabled={isWaitState}
                                            className={`${isWaitState ? "opacity-50" : ""} data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 dark:data-[state=checked]:bg-blue-500 dark:data-[state=checked]:border-blue-500`}
                                        />
                                        <label
                                            htmlFor={`senior-${topic}`}
                                            className={`text-sm flex items-center ${isWaitState ? "cursor-not-allowed" : "cursor-pointer"} text-gray-900 dark:text-gray-100`}
                                        >
                                            <Badge
                                                variant="outline"
                                                className={getTopicBadgeStyle(topic)}
                                            >
                                                {topic}

                                            </Badge>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </Accordion>

                    {/* 어인정 주제 아코디언 */}
                    <Accordion
                        title={`어인정 주제 (${selectedYouthTopics.length}/${injungTheme.length})`}
                        icon={<Book size={18} className="text-purple-600 dark:text-purple-400" />}
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {injungTheme.map(topic => {
                                const isWaitState = wordInfo.topic.waitAdd.includes(topic) || wordInfo.topic.waitDel.includes(topic);

                                return (
                                    <div
                                        key={`youth-${topic}`}
                                        className="flex items-center space-x-2"
                                    >
                                        <Checkbox
                                            id={`youth-${topic}`}
                                            checked={selectedYouthTopics.includes(topic)}
                                            onCheckedChange={() => handleTopicToggle(topic)}
                                            disabled={isWaitState}
                                            className={`${isWaitState ? "opacity-50" : ""} data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 dark:data-[state=checked]:bg-purple-500 dark:data-[state=checked]:border-purple-500`}
                                        />
                                        <label
                                            htmlFor={`youth-${topic}`}
                                            className={`text-sm flex items-center ${isWaitState ? "cursor-not-allowed" : "cursor-pointer"} text-gray-900 dark:text-gray-100`}
                                        >
                                            <Badge
                                                variant="outline"
                                                className={getTopicBadgeStyle(topic)}
                                            >
                                                {topic}

                                            </Badge>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </Accordion>
                </div>

                <DialogFooter className="mt-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="mr-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                        취소
                    </Button>
                    <Button
                        disabled={isSaving}
                        onClick={() => {
                            if (!isSaving) setConfirmModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white flex items-center gap-2"
                    >
                        <Save size={16} />
                        변경사항 저장
                    </Button>
                </DialogFooter>
            </DialogContent>
            {confirmModalOpen && (
                <ConfirmModal
                    open={confirmModalOpen}
                    title={`"${wordInfo.word}" 단어의 주제 수정 요청을 넣으시겠습니까?`}
                    description={"요청 후 취소할 수 없습니다."}
                    onConfirm={handleSave}
                    onClose={() => setConfirmModalOpen(false)}
                />
            )}
        </Dialog>
    );
}

export default WordThemeEditModal;
