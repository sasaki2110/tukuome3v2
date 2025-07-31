import { fetchAuthers } from "@/lib/services";
import { AutherListWithLoadMore } from "@/app/components/AutherListWithLoadMore";
import { ITEMS_PER_PAGE } from "@/lib/utils";

const AuthersPage = async () => {
  const { authers: initialAuthers, hasMore: initialHasMore } = await fetchAuthers(
    0,
    ITEMS_PER_PAGE
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">作者一覧</h1>
      <AutherListWithLoadMore
        initialAuthers={initialAuthers}
        initialOffset={0}
        initialHasMore={initialHasMore}
      />
    </div>
  );
};

export default AuthersPage;
