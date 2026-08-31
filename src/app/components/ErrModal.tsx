import React, { useState, useEffect } from "react";
import { AlertCircle, Send, ChevronDown, ChevronUp, X } from "lucide-react";

const ERROR_REPORT_URL = "https://api.solidloop-studio.xyz/api/v1/app-error-report";

type ErrorModalProps = {
  error: ErrorMessage;
  onClose: () => void;
};

type ReportStatus = {
  type: "success" | "error";
  message: string;
};

const ErrorModal = ({ error, onClose }: ErrorModalProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // 모달이 닫힐 때 페이드아웃 애니메이션 적용
  const handleClose = () => {
    setFadeOut(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleReport = async () => {
    setIsReporting(true);
    setReportStatus(null);

    try {
      const response = await fetch(ERROR_REPORT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.ErrMessage || error.ErrName || "알 수 없는 오류",
          ...(error.ErrStackRace ? { stack: error.ErrStackRace } : {}),
          ...(error.ErrName ? { errorCode: error.ErrName } : {}),
          severity: "ERROR",
          url: error.location || window.location.pathname,
          component: error.component,
          browser: navigator.userAgent,
        }),
      });

      if (!response.ok) throw new Error("Error report request failed");
      setReportStatus({ type: "success", message: "오류가 전송되었습니다." });
    } catch {
      setReportStatus({
        type: "error",
        message: "오류 전송에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    } finally {
      setIsReporting(false);
    }
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscKey);
    return () => {
      window.removeEventListener("keydown", handleEscKey);
    };
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm transition-opacity duration-300 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleClose}
    >
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden transition-all duration-300 transform ${
          fadeOut ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/30 p-4 border-b border-red-100 dark:border-red-800">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400">
              오류가 발생했습니다
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 오류 내용 */}
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-start">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-24 flex-shrink-0">오류명:</span>
              <span className="text-gray-800 dark:text-gray-200 font-semibold">{error.ErrName || "알 수 없음"}</span>
            </div>
            <div className="flex items-start">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-24 flex-shrink-0">오류 메시지:</span>
              <span className="text-gray-800 dark:text-gray-200">{error.ErrMessage || "오류 메시지가 없습니다"}</span>
            </div>
          </div>

          {/* 확장 버튼 */}
          <button
            className="mt-6 flex items-center justify-between w-full px-4 py-2 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>상세 오류 정보 {isExpanded ? "숨기기" : "보기"}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* 확장된 오류 정보 */}
          {isExpanded && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3 overflow-auto max-h-64">
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">사용자 입력:</h3>
                <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200">
                  {error.inputValue || "없음"}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">스택 트레이스:</h3>
                <pre className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300 overflow-x-auto">
                  {error.ErrStackRace || "없음"}
                </pre>
              </div>
              
              {error.HTTPStatus && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">HTTP 상태 코드:</h3>
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200">
                    {error.HTTPStatus}
                  </div>
                </div>
              )}
              
              {error.HTTPData && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">반환 데이터:</h3>
                  <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 break-words">
                    {error.HTTPData}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 오류 신고 상태 메시지 */}
          {reportStatus && (
            <div
              role={reportStatus.type === "error" ? "alert" : "status"}
              className={`mt-4 text-center text-sm p-2 rounded-md border animate-pulse ${
                reportStatus.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800"
              }`}
            >
              {reportStatus.message}
            </div>
          )}
        </div>

        {/* 푸터 / 버튼 영역 */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3">
          <button
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
            onClick={handleClose}
          >
            닫기
          </button>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium flex items-center space-x-1 transition-colors"
            onClick={handleReport}
            disabled={isReporting}
            aria-busy={isReporting}
          >
            <Send className="w-4 h-4" />
            <span>{isReporting ? "전송 중..." : "오류 신고"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
