import Image from 'next/image';
import Link from 'next/link';
import type { Auther } from '@/app/model/model';

type AutherCardProps = {
  auther: Auther;
};

const AutherCard = ({ auther }: AutherCardProps) => {
  const displayName = auther.name || '作者未設定';
  return (
    <Link href={`/recipes?title=${encodeURIComponent(displayName)}`} className="block border rounded-lg overflow-hidden shadow-lg flex flex-col h-full">
      <div className="relative w-full h-40">
        <Image
          src={auther.image || '/mock-image.png'} // 画像がない場合のプレースホルダー
          alt={displayName}
          fill
          className="object-cover"
        />
      </div>
      <div className="p-3 flex flex-col flex-grow">
        <h3 className="font-bold text-lg mb-2">{displayName}</h3>
        <p className="text-sm text-gray-600 mt-auto">{auther.recipesu.toLocaleString('ja-JP')} レシピ</p>
      </div>
    </Link>
  );
};

export default AutherCard;
