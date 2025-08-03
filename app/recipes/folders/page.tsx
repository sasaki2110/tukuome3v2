import { fetchFoldersWithImages } from '@/lib/services';
import Link from 'next/link';
import Image from 'next/image';

export default async function FoldersPage() {
  const folders = await fetchFoldersWithImages();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">フォルダー一覧</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {folders.map((folder) => (
          <Link key={folder.foldername} href={`/recipes?folder=${encodeURIComponent(folder.foldername)}`}>
            <div className="border rounded-lg overflow-hidden shadow-lg h-full flex flex-col">
              <div className="p-4">
                <h2 className="text-xl font-bold">{folder.foldername}</h2>
              </div>
              <div className="grid grid-cols-2 gap-1 flex-grow">
                {folder.images.map((image, index) => (
                  <div key={index} className="relative h-24">
                    <Image src={image} alt={`${folder.foldername} recipe image ${index + 1}`} layout="fill" objectFit="cover" />
                  </div>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}