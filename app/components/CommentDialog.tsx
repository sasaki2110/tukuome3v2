
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";

interface CommentDialogProps {
  isOpen: boolean;
  recipeName: string;
  currentComment: string;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}

export const CommentDialog: React.FC<CommentDialogProps> = ({
  isOpen,
  onClose,
  recipeName,
  currentComment,
  onSubmit,
}) => {
  const [comment, setComment] = useState("");

  useEffect(() => {
    setComment(currentComment);
  }, [currentComment]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComment(e.target.value);
  };

  const handleSubmit = () => {
    onSubmit(comment);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{recipeName}</DialogTitle>
        </DialogHeader>
        <Textarea value={comment} onChange={handleCommentChange} className="text-xl md:text-xl" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit}>実行</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
