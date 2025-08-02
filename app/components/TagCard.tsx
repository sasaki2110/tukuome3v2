import Image from 'next/image';
import { DispTag } from '@/app/model/model';

interface TagCardProps {
  tag: DispTag;
  onClick: (tag: DispTag) => void;
}

export function TagCard({ tag, onClick }: TagCardProps) {
  const hasImage = tag.hasimageuri === '1';

  return (
    <div
      className="relative flex items-center justify-center w-full aspect-square rounded-lg overflow-hidden shadow-lg cursor-pointer bg-white"
      onClick={() => onClick(tag)}
    >
      {/* レイヤー1: 背景画像 */}
      {hasImage && (
        <Image
          src={tag.imageuri}
          alt={tag.dispname}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          className="object-cover"
        />
      )}

      {/* レイヤー2: 半透明オーバーレイ (画像がある時のみ) */}
      {hasImage && <div className="absolute inset-0 bg-black/30"></div>}

      {/* レイヤー3: テキストコンテンツ (常に最前面) */}
      <div className="relative z-10 text-center">
        <div className={`text-2xl font-bold ${hasImage ? 'text-white' : 'text-black'}`}>
          {tag.dispname}
        </div>
      </div>

      {/* 右下の件数表示 (常に最前面) */}
      <div className="absolute z-10 bottom-2 right-2 bg-gray-800/75 text-white text-sm px-2 py-1 rounded">
        {tag.hasschildren}
      </div>
    </div>
  );
}