'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTagsByName } from '@/lib/services';
import { Tag } from '@/app/model/model';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Define a recursive TagNode interface
interface TagNode extends Tag {
  children: TagNode[];
  isSelectable: boolean; // True if it's a leaf node (no children)
}

interface TagSelectionGroupProps {
  patterns: string[];
  selectedTags: Tag[];
  onSelectionChange: (selectedTags: Tag[]) => void;
  onTagsFetched: (tags: Tag[]) => void; // Callback to pass all fetched tags
  componentKey?: string;
}

// Helper function to build the hierarchical tag tree
const buildTagTree = (tags: Tag[], patterns: string[]): TagNode[] => {
  const nodes: Record<string, TagNode> = {};
  const rootNodes: TagNode[] = [];
  const patternBases = patterns.map(p => p.replace(/%/g, '')); // e.g., ["素材別", "料理"]

  // First pass: Create all nodes and map them by their full name
  tags.forEach(tag => {
    nodes[tag.name] = { ...tag, children: [], isSelectable: true };
  });

  // Second pass: Build the hierarchy
  tags.forEach(tag => {
    const currentNode = nodes[tag.name];
    const potentialParentName = tag.name.substring(0, tag.name.length - tag.dispname.length);
    if (potentialParentName && nodes[potentialParentName]) {
      const parentNode = nodes[potentialParentName];
      parentNode.children.push(currentNode);
      parentNode.isSelectable = false;
    } else {
      rootNodes.push(currentNode);
    }
  });

  // Third pass: Filter out nodes that are children of other nodes, and ensure they match the pattern
  const finalRootNodes = rootNodes.filter(node => {
    const isChildOfAnotherNode = Object.values(nodes).some(otherNode =>
      otherNode.children.includes(node)
    );
    return !isChildOfAnotherNode && patternBases.some(base => node.name.startsWith(base));
  });

  Object.values(nodes).forEach(node => node.children.sort((a, b) => a.id - b.id));
  return finalRootNodes.sort((a, b) => a.id - b.id);
};


// Recursive component to render accordion items or checkboxes
interface TagAccordionNodeProps {
  node: TagNode;
  selectedTags: Tag[];
  onTagSelection: (tag: Tag, checked: boolean) => void;
}

const TagAccordionNode: React.FC<TagAccordionNodeProps> = ({ node, selectedTags, onTagSelection }) => {
  if (node.isSelectable) {
    return (
      <div key={node.id} className="flex items-center space-x-2">
        <Checkbox
          id={`tag-${node.id}`}
          onCheckedChange={(checked) => onTagSelection(node, !!checked)}
          checked={selectedTags.some(t => t.name === node.name)}
        />
        <label htmlFor={`tag-${node.id}`}>{node.dispname}</label>
      </div>
    );
  } else {
    return (
      <AccordionItem value={node.name} key={node.name}>
        <AccordionTrigger>{node.dispname}</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2 pl-4">
            {node.children.map(child => (
              <TagAccordionNode
                key={child.id}
                node={child}
                selectedTags={selectedTags}
                onTagSelection={onTagSelection}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }
};


// グローバルな実行制御フラグ
const executionFlags = new Map<string, boolean>();

export default function TagSelectionGroup({ patterns, selectedTags, onSelectionChange, onTagsFetched, componentKey }: TagSelectionGroupProps) {
  const [tagTree, setTagTree] = useState<TagNode[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  const handleTagSelection = useCallback((tag: Tag, checked: boolean) => {
    let newSelectedTags;
    if (checked) {
      newSelectedTags = [...selectedTags, tag];
    } else {
      newSelectedTags = selectedTags.filter((t) => t.name !== tag.name);
    }
    onSelectionChange(newSelectedTags);
  }, [selectedTags, onSelectionChange]);


  useEffect(() => {
    const executionKey = `${componentKey}-${patterns.join(',')}`;
    
    // グローバルフラグで重複実行を防ぐ
    if (executionFlags.get(executionKey)) {
      return;
    }
    
    async function fetchAndProcessTags() {
      executionFlags.set(executionKey, true); // グローバルフラグを設定
      setHasInitialized(true); // ローカルフラグも設定
      
      // パターンを並列で取得
      const patternPromises = patterns.map(async (p) => {
        const tags = await getTagsByName(p);
        return tags;
      });
      
      const patternResults = await Promise.all(patternPromises);
      const fetched: Tag[] = patternResults.flat();
      
      const uniqueTags = fetched.filter((tag, index, self) => index === self.findIndex((t) => t.id === tag.id));
      const tree = buildTagTree(uniqueTags, patterns);
      setTagTree(tree);

      // Extract only selectable (leaf) tags to pass to the parent
      const selectableTags: Tag[] = [];
      const traverse = (nodes: TagNode[]) => {
        nodes.forEach(node => {
          if (node.isSelectable) {
            selectableTags.push(node);
          } else {
            traverse(node.children);
          }
        });
      };
      traverse(tree);
      
      onTagsFetched(selectableTags);
      
      // 処理完了後にフラグをクリア
      executionFlags.delete(executionKey);
    }
    fetchAndProcessTags();
  }, [patterns, componentKey]); // componentKeyを依存配列に追加

  // コンポーネントのアンマウント時にフラグをクリア（バックアップ）
  useEffect(() => {
    return () => {
      const executionKey = `${componentKey}-${patterns.join(',')}`;
      if (executionKey) {
        // 少し遅延してクリア（処理中の可能性を考慮）
        setTimeout(() => {
          executionFlags.delete(executionKey);
        }, 1000);
      }
    };
  }, [componentKey, patterns]);

  return (
    <Accordion type="multiple" className="w-full overflow-y-auto max-h-80">
      {tagTree.map(node => (
        <TagAccordionNode
          key={node.id}
          node={node}
          selectedTags={selectedTags}
          onTagSelection={handleTagSelection}
        />
      ))}
    </Accordion>
  );
}