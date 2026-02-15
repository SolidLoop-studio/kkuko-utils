'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
            <div>
              <h1 className="mt-4 text-center text-4xl font-extrabold text-gray-900">
                500
              </h1>
              <h2 className="mt-2 text-center text-2xl font-bold text-gray-900">
                서버 오류
              </h2>
              <div className="mt-6 flex justify-center">
                <svg
                  className="h-20 w-20 text-red-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="mt-4 text-center text-base text-gray-600">
                심각한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
              </p>
              {error.message && (
                <div className="mt-6 bg-red-50 p-4 rounded-md">
                  <p className="text-sm text-red-700">
                    오류 상세: {error.message}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-red-500 mt-1">
                      오류 코드: {error.digest}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="mt-8">
              <button
                onClick={() => reset()}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                페이지 다시 로드하기
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}