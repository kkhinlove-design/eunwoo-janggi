'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('janggi-player-name');
    if (stored) {
      setName(stored);
      setSavedName(stored);
    }
  }, []);

  const saveName = () => {
    localStorage.setItem('janggi-player-name', name);
    setSavedName(name);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">♟️</div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          은우의 장기
        </h1>
        <p className="text-gray-500 mb-6 text-sm">Korean Chess (Janggi)</p>

        {/* Player name */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
            <button onClick={saveName} className="btn-primary text-sm !py-2 !px-3">
              저장
            </button>
          </div>
          {savedName && (
            <p className="text-green-600 text-xs mt-1">안녕하세요, {savedName}님!</p>
          )}
        </div>

        {/* Menu */}
        <div className="flex flex-col gap-3">
          <Link href="/play" className="btn-primary text-center text-lg">
            🤖 혼자 연습하기 (AI 대전)
          </Link>
          <Link href="/local" className="btn-secondary text-center text-lg">
            👫 친구와 대결 (로컬 대전)
          </Link>
        </div>

        {/* Rules summary */}
        <div className="mt-6 text-left text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <p className="font-semibold text-gray-700 mb-1">장기 규칙 요약</p>
          <ul className="space-y-0.5">
            <li>궁 - 궁성 안에서 한 칸 이동</li>
            <li>車 - 직선 무한 이동</li>
            <li>包 - 하나를 뛰어넘어 이동 (포끼리 불가)</li>
            <li>馬 - 날 일(日)자 이동 (막힘 있음)</li>
            <li>象 - 날 용(用)자 이동 (막힘 있음)</li>
            <li>士 - 궁성 안에서 한 칸 이동</li>
            <li>卒/兵 - 앞 또는 옆으로 한 칸</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
