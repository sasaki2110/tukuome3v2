
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState(''); // エラーメッセージ用のStateを追加
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(''); // ログイン試行時にエラーメッセージをクリア

    const result = await signIn('credentials', {
      redirect: false,
      username,
    });

    if (result?.ok) {
      router.push('/recipes');
    } else {
      // エラーメッセージを設定
      setErrorMessage('正しいユーザー名を入力してください');
      console.error('Login failed:', result?.error); // デバッグ用に残しておくのは良いでしょう
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div className="w-full max-w-xs p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">ログイン</h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              ユーザー名
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="block w-full px-3 py-2 mt-1 text-gray-900 bg-gray-200 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          {errorMessage && ( // errorMessageが存在する場合のみ表示
            <p className="text-red-500 text-sm text-center">{errorMessage}</p>
          )}
          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              サインイン
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
