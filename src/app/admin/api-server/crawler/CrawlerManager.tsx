'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchCrawlerHealth, saveCrawlerSession, restartCrawler, type ChannelHealth } from '@/src/modules/admin-api-server';
import { Button } from '@/src/app/components/ui/button';
import ConfirmModal from '@/src/app/components/ConfirmModal';
import CompleteModal from '@/src/app/components/CompleteModal';
import FailModal from '@/src/app/components/FailModal';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CrawlerManager() {
  const [channels, setChannels] = useState<ChannelHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionData, setSessionData] = useState({
    channelId: '',
    jwtToken: '',
    refreshToken: '',
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [restartLoading, setRestartLoading] = useState<string | null>(null);

  // Modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [targetChannel, setTargetChannel] = useState<string | null>(null);

  const loadCrawlerHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchCrawlerHealth();
      setChannels(data.channels);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : '크롤러 상태를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCrawlerHealth();
    const interval = setInterval(() => {
      void loadCrawlerHealth();
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [loadCrawlerHealth]);

  const initiateRestart = (channelId: string) => {
    setTargetChannel(channelId);
    setConfirmOpen(true);
  };

  const handleRestartConfirm = async () => {
    if (!targetChannel) return;
    
    // Close confirm modal
    setConfirmOpen(false);
    
    try {
      setRestartLoading(targetChannel);
      await restartCrawler(targetChannel);
      await loadCrawlerHealth();
      setModalMessage(`${targetChannel} 채널 재시작 요청을 완료했습니다.`);
      setSuccessOpen(true);
    } catch (err) {
      setModalMessage(err instanceof Error ? err.message : '재시작 요청에 실패했습니다.');
      setFailOpen(true);
    } finally {
      setRestartLoading(null);
      setTargetChannel(null);
    }
  };

  const handleSessionSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    setError('');

    try {
      await saveCrawlerSession(sessionData);
      setSaveSuccess(true);
      setSessionData({ channelId: '', jwtToken: '', refreshToken: '' });
      setTimeout(() => {
        setShowSessionForm(false);
        setSaveSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '세션 저장에 실패했습니다.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href={'/admin/api-server'} className="mb-4 flex">
        <Button variant="outline">
          <ArrowLeft />
          api-server admin 홈으로 이동
        </Button>
      </Link>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">Crawler 관리</h1>
        <p className="text-gray-600 dark:text-gray-300">크롤러 Health 상태 및 세션 관리</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded">
          {error}
        </div>
      )}

      {/* Health Status Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-gray-100">채널 Health 상태</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => void loadCrawlerHealth()}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              {loading ? '로딩중...' : '새로고침'}
            </button>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              마지막 갱신: {lastUpdated ? lastUpdated.toLocaleString() : '—'}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>
        ) : channels.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">채널 정보가 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className={`flex flex-col p-4 border rounded cursor-pointer transition-colors ${
                  selectedChannel === channel.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedChannel(selectedChannel === channel.id ? null : channel.id)}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium dark:text-gray-200">{channel.id}</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      channel.healthy
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}
                  >
                    {channel.healthy ? 'Healthy' : 'Unhealthy'}
                  </span>
                </div>
                
                {selectedChannel === channel.id && (
                  <div className="mt-4 pt-4 border-t dark:border-gray-600 animate-in fade-in slide-in-from-top-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      disabled={restartLoading === channel.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        initiateRestart(channel.id);
                      }}
                    >
                      {restartLoading === channel.id ? '요청 중...' : '크롤러 재시작'}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Management Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-gray-100">세션 관리</h2>
          <button
            onClick={() => setShowSessionForm(!showSessionForm)}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            {showSessionForm ? '취소' : '세션 저장'}
          </button>
        </div>

        {showSessionForm && (
          <form onSubmit={handleSessionSave} className="space-y-4">
            <div>
              <label htmlFor="channelId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Channel ID
              </label>
              <input
                type="text"
                id="channelId"
                value={sessionData.channelId}
                onChange={(e) => setSessionData({ ...sessionData, channelId: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label htmlFor="jwtToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                JWT Token
              </label>
              <textarea
                id="jwtToken"
                value={sessionData.jwtToken}
                onChange={(e) => setSessionData({ ...sessionData, jwtToken: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label htmlFor="refreshToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Refresh Token
              </label>
              <textarea
                id="refreshToken"
                value={sessionData.refreshToken}
                onChange={(e) => setSessionData({ ...sessionData, refreshToken: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled={saveLoading}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              {saveLoading ? '저장 중...' : '저장'}
            </button>

            {saveSuccess && (
              <div className="p-4 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200 rounded">
                세션이 성공적으로 저장되었습니다!
              </div>
            )}
          </form>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRestartConfirm}
        title="크롤러 재시작"
        description={`${targetChannel} 채널의 크롤러를 재시작하시겠습니까?`}
      />

      <CompleteModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="요청 성공"
        description={modalMessage}
      />

      <FailModal
        open={failOpen}
        onClose={() => setFailOpen(false)}
        title="요청 실패"
        description={modalMessage}
      />
    </div>
  );
}
