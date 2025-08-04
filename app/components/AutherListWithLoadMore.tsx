'use client';

import { useState } from 'react';
import AutherCard from './AutherCard';
import { Auther } from '@/app/model/model';
import { fetchAuthers } from '@/lib/services';
import { calculateNextOffset } from '@/lib/constants';
import { ITEMS_PER_PAGE } from '@/lib/constants';

interface AutherListWithLoadMoreProps {
  initialAuthers: Auther[];
  initialOffset: number;
  initialHasMore: boolean;
}

export function AutherListWithLoadMore({
  initialAuthers,
  initialOffset,
  initialHasMore,
}: AutherListWithLoadMoreProps) {
  const [authers, setAuthers] = useState<Auther[]>(initialAuthers);
  const [offset, setOffset] = useState<number>(initialOffset);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loading, setLoading] = useState<boolean>(false);

  const loadMoreAuthers = async () => {
    setLoading(true);
    const nextOffset = calculateNextOffset(offset);
    const { authers: newAuthers, hasMore: newHasMore } = await fetchAuthers(
      nextOffset,
      ITEMS_PER_PAGE
    );
    setAuthers((prevAuthers) => [...prevAuthers, ...newAuthers]);
    setOffset(nextOffset);
    setHasMore(newHasMore);
    setLoading(false);
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {authers.map((auther) => (
          <AutherCard key={auther.name} auther={auther} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMoreAuthers}
            disabled={loading}
            className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '読み込み中...' : 'もっと見る'}
          </button>
        </div>
      )}
    </div>
  );
}
