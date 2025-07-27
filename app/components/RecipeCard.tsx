import Image from 'next/image';
import type { Repo } from '@/app/model/model';

type RecipeCardProps = {
  recipe: Repo;
};

const RecipeCard = ({ recipe }: RecipeCardProps) => {
  // いいね数をカンマ区切りにする関数
  const formatLikes = (num: number) => {
    return num.toLocaleString('ja-JP') + ' 件';
  };

  return (
    <a
      href={`https://cookpad.com/jp/recipes/${recipe.id_n}`}
      target="_blank"
      rel="noopener noreferrer"
      className="border rounded-lg overflow-hidden shadow-lg flex flex-col h-full cursor-pointer"
    >
      {/* 画像エリア */}
      <div className="relative w-full h-40">
        <Image
          src={recipe.image || '/no-image.png'} // 画像がない場合のプレースホルダー画像
          alt={recipe.title}
          fill
          className="object-cover"
        />
      </div>

      <div className="p-3 flex flex-col flex-grow">
        {/* タイトル */}
        <h3 className="font-bold text-md mb-2">{recipe.title}</h3>

        {/* いいね数 */}
        <p className="text-sm text-gray-600 mb-3">
          いいね数: {formatLikes(recipe.reposu_n)}
        </p>

        {/* 操作アイコンエリア */}
        <div className="flex justify-around items-center text-xl mt-auto">
          {/* ハート（いいね） */}
          <span>{recipe.rank === 1 ? '❤️' : '🤍'}</span>

          {/* 既読（チェック） */}
          <span>{recipe.ismain === 9 ? '✅' : '☑️'}</span>

          {/* フォルダ（星） */}
          <span>{'⭐'}</span>

          {/* コメント */}
          <span>{recipe.comment ? '💬' : '🗨️'}</span>
        </div>
      </div>
    </a>
  );
};

export default RecipeCard;