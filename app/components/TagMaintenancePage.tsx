'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loadMasterTags, updateTags } from '@/app/recipes/tags/maintenance/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react'; // Loader2をインポート

export default function TagMaintenancePage() {
  const [masterTags, setMasterTags] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    loadMasterTags(1).then((result) => {
      if (result.success) {
        setMasterTags(result.data || '');
      } else {
        alert(result.message);
      }
      setIsLoading(false);
    });
  }, []);

  const handleLoadBackup = () => {
    startTransition(async () => {
        const result = await loadMasterTags(0);
        if (result.success) {
            setMasterTags(result.data || '');
            alert('ひとつ前のマスタを読み込みました。');
        } else {
            alert(result.message);
        }
    });
  };

  const handleSubmit = async () => {
    const confirmation = confirm(
      "マスタタグを生成します。\n処理時間に２分ほど頂戴いたします。\n実行してもよろしいですか？"
    );

    if (!confirmation) {
      return;
    }

    const formData = new FormData();
    formData.append('masterTags', masterTags);

    startTransition(async () => {
      const result = await updateTags(formData);
      if (result.success) {
        alert(result.message);
      } else {
        alert(result.message);
      }
    });
  };

  if (isLoading) {
    return <div className="container mx-auto p-4">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">タグメンテナンス（タグ間はTABで区切って下さい。）</h1>
      <div className="space-y-4">
        <Textarea
          value={masterTags}
          onChange={(e) => setMasterTags(e.target.value)}
          rows={25}
          className="w-full p-2 border rounded"
          placeholder="マスタータグをタブ区切りで入力..."
        />
        <div className="flex justify-between items-center">
            <div className='flex gap-2'>
                <Button onClick={handleSubmit} disabled={isPending}>
                    {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        'マスタタグ生成'
                    )}
                </Button>
                <Button onClick={handleLoadBackup} variant="outline" disabled={isPending}>
                    {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        'ひとつ前のマスタを開く'
                    )}
                </Button>
            </div>
            <Button onClick={() => router.push('/recipes')} variant="ghost">
                閉じる
            </Button>
        </div>
      </div>
    </div>
  );
}
