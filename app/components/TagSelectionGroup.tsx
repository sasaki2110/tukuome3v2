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
  onSelectionChange: (selectedTags: Tag[]) => void;
  suggestedTagNames?: string[];
  componentKey?: string; // To force re-render when suggestions change
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

    // Determine potential parent name by removing the current tag's dispname from its full name
    // This assumes dispname is the last part of the name
    const potentialParentName = tag.name.substring(0, tag.name.length - tag.dispname.length);

    // If a potential parent exists and is in our nodes map
    if (potentialParentName && nodes[potentialParentName]) {
      const parentNode = nodes[potentialParentName];
      parentNode.children.push(currentNode);
      parentNode.isSelectable = false; // A node with children is not selectable itself
    } else {
      // If no parent found, it's a potential root node.
      rootNodes.push(currentNode);
    }
  });

  // Third pass: Filter out nodes that are children of other nodes, and ensure they match the pattern
  const finalRootNodes = rootNodes.filter(node => {
    const isChildOfAnotherNode = Object.values(nodes).some(otherNode =>
      otherNode.children.includes(node)
    );
    // A node is a true root if it's not a child and its name starts with one of the pattern bases.
    return !isChildOfAnotherNode && patternBases.some(base => node.name.startsWith(base));
  });

  // Sort children for consistent display
  Object.values(nodes).forEach(node => {
    node.children.sort((a, b) => a.id - b.id);
  });

  // Sort final root nodes
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
    // Render as a checkbox if it's a leaf node
    return (
      <div key={node.id} className="flex items-center space-x-2">
        <Checkbox
          id={`tag-${node.id}`}
          onCheckedChange={(checked) => onTagSelection(node, !!checked)}
          checked={selectedTags.some(t => t.id === node.id)}
        />
        <label htmlFor={`tag-${node.id}`}>{node.dispname}</label>
      </div>
    );
  } else {
    // Render as an accordion item if it has children
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


export default function TagSelectionGroup({ patterns, onSelectionChange, suggestedTagNames, componentKey }: TagSelectionGroupProps) {
  const patternForLog = patterns.join(',');
  console.log(`TagSelectionGroup: patterns=${patternForLog}, componentKey=${componentKey}, suggestedTagNames=`, suggestedTagNames);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagTree, setTagTree] = useState<TagNode[]>([]);

  // Memoized callback for handling tag selection changes
  const handleTagSelection = useCallback((tag: Tag, checked: boolean) => {
    let newSelectedTags;
    if (checked) {
      newSelectedTags = [...selectedTags, tag];
    } else {
      newSelectedTags = selectedTags.filter((t) => t.id !== tag.id);
    }
    setSelectedTags(newSelectedTags);
    onSelectionChange(newSelectedTags);
    console.log(`TagSelectionGroup (${patternForLog}): handleTagSelection - newSelectedTags=`, newSelectedTags);
  }, [selectedTags, onSelectionChange, patternForLog]);


  useEffect(() => {
    async function fetchAndProcessTags() {
      let allFetchedTags: Tag[] = [];
      for (const p of patterns) {
        const fetchedTags = await getTagsByName(p);
        allFetchedTags.push(...fetchedTags);
      }
      // Remove duplicates
      allFetchedTags = allFetchedTags.filter((tag, index, self) =>
        index === self.findIndex((t) => t.id === tag.id)
      );

      setAllTags(allFetchedTags);
      console.log(`TagSelectionGroup (${patternForLog}): fetchedTags=`, allFetchedTags);

      const tree = buildTagTree(allFetchedTags, patterns);
      setTagTree(tree);
      console.log(`TagSelectionGroup (${patternForLog}): tagTree=`, tree);
    }
    fetchAndProcessTags();
  }, [patterns, componentKey]);

  useEffect(() => {
    if (allTags.length === 0) return;

    // Create a flat list of all selectable tag names from the built tree
    const allSelectableTagNames: string[] = [];
    const traverseAndCollectSelectable = (nodes: TagNode[]) => {
      nodes.forEach(node => {
        if (node.isSelectable) {
          allSelectableTagNames.push(node.name);
        } else {
          traverseAndCollectSelectable(node.children);
        }
      });
    };
    traverseAndCollectSelectable(tagTree);

    // Pre-select tags based on suggestions, ensuring they are selectable leaf nodes
    if (suggestedTagNames && suggestedTagNames.length > 0) {
      const suggested = allTags.filter(t =>
        suggestedTagNames.includes(t.name) && allSelectableTagNames.includes(t.name)
      );
      setSelectedTags(suggested);
      onSelectionChange(suggested);
    } else {
      setSelectedTags([]); // Clear selection if no suggestions
      onSelectionChange([]);
    }
  }, [suggestedTagNames, allTags, tagTree, onSelectionChange, patternForLog]);

  return (
    <Accordion type="multiple" className="w-full overflow-y-auto max-h-140">
      {tagTree.map(node => (
        <TagAccordionNode
          key={node.id} // Use node.id as key for top-level accordion items
          node={node}
          selectedTags={selectedTags}
          onTagSelection={handleTagSelection}
        />
      ))}
    </Accordion>
  );
}