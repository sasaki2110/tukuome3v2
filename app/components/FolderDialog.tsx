'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
} from '@/lib/services';

interface FolderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  recipe: Repo | null;
}

export function FolderDialog({ isOpen, onOpenChange, recipe }: FolderDialogProps) {
  const [folders, setFolders] = useState<(Folder & { isInFolder: boolean })[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // 新しい状態変数

  const loadFolders = useCallback(async () => {
    if (!recipe) return;
    const fetchedFolders = await fetchFolders(String(recipe.id_n));
    setFolders(fetchedFolders);
  }, [recipe]);

  useEffect(() => {
    if (isOpen && recipe) {
      loadFolders();
    }
    if (isOpen) {
      // DialogContentにフォーカスを当てる
      const dialogContent = document.querySelector('[data-radix-dialog-content]');
      if (dialogContent) {
        (dialogContent as HTMLElement).focus();
      }
    }
  }, [isOpen, recipe, loadFolders]);

  const handleAddFolder = async () => {
    if (newFolderName.trim() === '') return;
    await createFolder(newFolderName);
    setNewFolderName('');
    loadFolders();
  };

  const handleDeleteFolderClick = (folderName: string) => {
    setFolderToDelete(folderName);
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (folderToDelete) {
      await removeFolder(folderToDelete);
      loadFolders();
      setFolderToDelete(null);
    }
    setShowConfirmDialog(false);
  };

  const handleCancelDelete = () => {
    setFolderToDelete(null);
    setShowConfirmDialog(false);
  };

  const handleToggleRecipeInFolder = async (folderName: string, isInFolder: boolean) => {
    if (!recipe || isProcessing) return; // 処理中は多重クリックを防止

    setIsProcessing(true); // 処理開始
    const recipeId = String(recipe.id_n);

    try {
      if (isInFolder) {
        await removeRecipeFromFolderAction(folderName, recipeId);
      } else {
        await addRecipeToFolderAction(folderName, recipeId);
      }
      await loadFolders(); // 処理完了後にフォルダリストを再読み込み
    } finally {
      setIsProcessing(false); // 処理終了
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent tabIndex={-1}>
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
          <ul className={isProcessing ? 'opacity-50 pointer-events-none' : ''}>
            {folders.map((folder) => (
              <li key={folder.foldername} className="flex items-center justify-between py-1">
                <span>{folder.foldername}</span>
                <div className="flex items-center">
                  <button onClick={() => handleToggleRecipeInFolder(folder.foldername, folder.isInFolder)} className={`mr-4 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Star fill={folder.isInFolder ? 'yellow' : 'none'} />
                  </button>
                  <button onClick={() => handleDeleteFolderClick(folder.foldername)}>
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

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>フォルダーを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作は元に戻せません。フォルダー内のレシピは削除されません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelDelete}>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>削除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}