'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Star } from 'lucide-react';
import Image from 'next/image'; // Imageコンポーネントをインポート
import { Repo, Folder } from '@/app/model/model';
import {
  fetchFolders,
  createFolder,
  removeFolder,
  addRecipeToFolderAction,
  removeRecipeFromFolderAction,
  checkRecipeInFolder,
} from '@/lib/services';

interface FolderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  recipe: Repo | null;
}

export function FolderDialog({ isOpen, onOpenChange, recipe }: FolderDialogProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [recipeInFolderStatus, setRecipeInFolderStatus] = useState<Record<string, boolean>>({});

  const loadFolders = useCallback(async () => {
    const fetchedFolders = await fetchFolders();
    setFolders(fetchedFolders);
  }, []);

  const checkAllFolders = useCallback(async () => {
    if (!recipe) return;
    const status: Record<string, boolean> = {};
    for (const folder of folders) {
      const isInFolder = await checkRecipeInFolder(folder.foldername, String(recipe.id_n));
      status[folder.foldername] = isInFolder;
    }
    setRecipeInFolderStatus(status);
  }, [recipe, folders]);

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen, loadFolders]);

  useEffect(() => {
    if (isOpen && recipe) {
      checkAllFolders();
    }
  }, [isOpen, recipe, checkAllFolders]);

  const handleAddFolder = async () => {
    if (newFolderName.trim() === '') return;
    await createFolder(newFolderName);
    setNewFolderName('');
    loadFolders();
  };

  const handleDeleteFolder = async (folderName: string) => {
    await removeFolder(folderName);
    loadFolders();
  };

  const handleToggleRecipeInFolder = async (folderName: string) => {
    if (!recipe) return;
    const recipeId = String(recipe.id_n);
    const isInFolder = recipeInFolderStatus[folderName];

    if (isInFolder) {
      await removeRecipeFromFolderAction(folderName, recipeId);
    } else {
      await addRecipeToFolderAction(folderName, recipeId);
    }
    checkAllFolders();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>フォルダーに追加</DialogTitle>
        </DialogHeader>
        {recipe && (
          <div>
            <h3 className="font-bold">{recipe.title}</h3>
            <div className="relative w-full h-64">
              <Image src={recipe.image} alt={recipe.title} layout="fill" objectFit="cover" />
            </div>
          </div>
        )}
        <div className="py-4">
          <h4 className="font-bold">フォルダー一覧</h4>
          <ul>
            {folders.map((folder) => (
              <li key={folder.foldername} className="flex items-center justify-between py-1">
                <span>{folder.foldername}</span>
                <div className="flex items-center space-x-2">
                  <button onClick={() => handleToggleRecipeInFolder(folder.foldername)}>
                    <Star fill={recipeInFolderStatus[folder.foldername] ? 'yellow' : 'none'} />
                  </button>
                  <button onClick={() => handleDeleteFolder(folder.foldername)}>
                    <Trash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="py-4">
          <h4 className="font-bold">新しいフォルダーを追加</h4>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="フォルダー名"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <Button onClick={handleAddFolder}>追加</Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}