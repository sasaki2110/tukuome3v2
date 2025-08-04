import Image from 'next/image';
import type { Repo } from '@/app/model/model';
import { CommentDialog } from './CommentDialog'; // CommentDialogをインポート
import { useState } from 'react'; // useStateをインポート
import { Star, Heart, MessageSquare } from 'lucide-react'; // Star, Heart, MessageSquareをインポート
import LikeDialog from './LikeDialog'; // LikeDialogをインポート

type RecipeCardProps = {
  recipe: Repo;
  onRankChange: (recipeId: number, rank: number) => void; // rank変更を親に通知する関数
  onCommentSubmit: (recipeId: number, comment: string) => void; // コメント投稿を親に通知する関数
  onFolderClick: () => void; // フォルダーアイコンクリックを親に通知する関数
};

const RecipeCard = ({ recipe, onRankChange, onCommentSubmit, onFolderClick }: RecipeCardProps) => {
  const [showCommentDialog, setShowCommentDialog] = useState(false); // コメントダイアログの表示状態
  const [showLikeDialog, setShowLikeDialog] = useState(false); // いいねダイアログの表示状態

  // いいね数をカンマ区切りにする関数
  const formatLikes = (num: number) => {
    return num.toLocaleString('ja-JP') + ' 件';
  };

  const handleOpenCommentDialog = () => {
    setShowCommentDialog(true);
  };

  const handleCloseCommentDialog = () => {
    setShowCommentDialog(false);
  };

  const handleSubmitComment = (comment: string) => {
    onCommentSubmit(recipe.id_n, comment);
    setShowCommentDialog(false);
  };

  const handleOpenLikeDialog = () => {
    setShowLikeDialog(true);
  };

  const handleCloseLikeDialog = () => {
    setShowLikeDialog(false);
  };

  const handleSubmitLike = (rank: number) => {
    onRankChange(recipe.id_n, rank);
    setShowLikeDialog(false);
  };

  return (
    <div className="border rounded-lg overflow-hidden shadow-lg flex flex-col h-full">
      {/* 画像とタイトルはaタグで囲み、詳細ページへのリンクとする */}
      <a
        href={`https://cookpad.com/jp/recipes/${recipe.id_n}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col flex-grow"
      >
        <div className="relative w-full h-40">
          <Image
            src={recipe.image || '/no-image.png'} // 画像がない場合のプレースホルダー画像
            alt={recipe.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="p-3 flex flex-col flex-grow">
          <h3 className="font-bold text-md mb-2">{recipe.title}</h3>
        </div>
      </a>

      {/* 操作アイコンエリア */}
      <div className="p-3 flex justify-around items-center text-xl mt-auto border-t">
        {/* つくれぽ数 */}
        <p className="text-sm text-gray-600">
          {formatLikes(recipe.reposu_n)}
        </p>

        {/* いいねボタン */}
        <button
          onClick={handleOpenLikeDialog}
          className="cursor-pointer">
          <Heart
            fill={recipe.rank === 1 ? 'red' : recipe.rank === 2 ? 'orange' : 'none'}
            stroke={recipe.rank === 1 ? 'red' : recipe.rank === 2 ? 'orange' : 'currentColor'}
          />
        </button>

        {/* フォルダ（星） */}
        <button onClick={onFolderClick} className="cursor-pointer">
          <Star fill={recipe.foldered ? 'yellow' : 'none'} stroke={recipe.foldered ? 'black' : 'currentColor'} />
        </button>

        {/* コメントボタン */}
        <button onClick={handleOpenCommentDialog} className={`cursor-pointer ${recipe.comment ? 'text-blue-500' : ''}`}>
          <MessageSquare fill={recipe.comment ? 'blue' : 'none'} stroke={recipe.comment ? 'blue' : 'currentColor'} />
        </button>
      </div>

      {/* CommentDialogをレンダリング */}
      <CommentDialog
        isOpen={showCommentDialog}
        recipeName={recipe.title}
        currentComment={recipe.comment || ''} // 既存のコメントがあれば表示
        onClose={handleCloseCommentDialog}
        onSubmit={handleSubmitComment}
      />

      {/* LikeDialogをレンダリング */}
      <LikeDialog
        isOpen={showLikeDialog}
        currentRank={recipe.rank}
        onClose={handleCloseLikeDialog}
        onSubmit={handleSubmitLike}
      />
    </div>
  );
};

export default RecipeCard;