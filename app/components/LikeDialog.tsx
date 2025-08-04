import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Heart } from "lucide-react";

type LikeDialogProps = {
  isOpen: boolean;
  currentRank: number;
  onClose: () => void;
  onSubmit: (rank: number) => void;
};

const LikeDialog = ({ isOpen, currentRank, onClose, onSubmit }: LikeDialogProps) => {
  const [selectedRank, setSelectedRank] = useState(currentRank);

  useEffect(() => {
    setSelectedRank(currentRank);
  }, [currentRank]);

  const handleSelectRank = (rank: number) => {
    setSelectedRank(rank);
  };

  const handleSubmit = () => {
    onSubmit(selectedRank);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>レシピの評価を選択してください</AlertDialogTitle>
          <AlertDialogDescription>
            このレシピに対するあなたの「好き」の度合いを選んでください。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-around p-4">
          <button
            className={`flex flex-col items-center p-2 rounded-md ${selectedRank === 1 ? "bg-red-100" : ""}`}
            onClick={() => handleSelectRank(1)}
          >
            <Heart fill="red" stroke="red" size={32} />
            <span className="text-sm mt-1">めっちゃ好き</span>
          </button>
          <button
            className={`flex flex-col items-center p-2 rounded-md ${selectedRank === 2 ? "bg-orange-100" : ""}`}
            onClick={() => handleSelectRank(2)}
          >
            <Heart fill="orange" stroke="orange" size={32} />
            <span className="text-sm mt-1">まあまあ</span>
          </button>
          <button
            className={`flex flex-col items-center p-2 rounded-md ${selectedRank === 0 ? "bg-gray-100" : ""}`}
            onClick={() => handleSelectRank(0)}
          >
            <Heart fill="none" stroke="currentColor" size={32} />
            <span className="text-sm mt-1">普通</span>
          </button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit}>実行</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LikeDialog;
