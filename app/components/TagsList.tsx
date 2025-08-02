'use client';

import { useState, useEffect } from 'react';
import { DispTag } from '@/app/model/model';
import { TagCard } from './TagCard';
import { getDispTags } from '@/lib/services';
import { useRouter } from 'next/navigation';

interface TagsListProps {
  initialTags: DispTag[];
}

export function TagsList({ initialTags }: TagsListProps) {
  const [tags, setTags] = useState<DispTag[]>(initialTags);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentValue, setCurrentValue] = useState('');
  const router = useRouter();

  useEffect(() => {
    // The initial tags are already passed as props, so this effect
    // will run when the user clicks a tag to drill down.
    if (currentLevel > 0) {
      async function fetchTags() {
        const newTags = await getDispTags(currentLevel, currentValue);
        setTags(newTags);
      }
      fetchTags();
    }
  }, [currentLevel, currentValue]);

  const handleTagClick = (tag: DispTag) => {
    if (tag.hasschildren === '▼') {
      setCurrentLevel(prevLevel => prevLevel + 1);
      setCurrentValue(tag.name);
    } else {
      router.push(`/recipes?tag=${tag.name}`);
    }
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 p-4">
      {tags.map((tag) => (
        <TagCard key={tag.id} tag={tag} onClick={handleTagClick} />
      ))}
    </div>
  );
}