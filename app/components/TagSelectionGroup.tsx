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
  pattern: string;
  onSelectionChange: (selectedTags: Tag[]) => void;
  suggestedTagNames?: string[];
  componentKey?: string; // To force re-render when suggestions change
}

// Helper function to build the hierarchical tag tree
const buildTagTree = (tags: Tag[], pattern: string): TagNode[] => {
  const nodes: Record<string, TagNode> = {};
  const rootNodes: TagNode[] = [];
  const patternBase = pattern.replace(/%/g, ''); // e.g., "素材別" or "料理"

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
      // Only add to rootNodes if it starts with the patternBase and is not a child of another node
      // (This filtering will be done in the third pass)
      rootNodes.push(currentNode);
    }
  });

  // Third pass: Filter out nodes that are children of other nodes, and ensure they match the pattern
  const finalRootNodes = rootNodes.filter(node => {
    // A node is a true root if it's not a child of any other node AND it matches the pattern
    const isChildOfAnotherNode = Object.values(nodes).some(otherNode =>
      otherNode.children.includes(node)
    );
    return !isChildOfAnotherNode && node.name.startsWith(patternBase);
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


export default function TagSelectionGroup({ pattern, onSelectionChange, suggestedTagNames, componentKey }: TagSelectionGroupProps) {
  console.log(`TagSelectionGroup: pattern=${pattern}, componentKey=${componentKey}, suggestedTagNames=`, suggestedTagNames);
  const [tags, setTags] = useState<Tag[]>([]);
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
    console.log(`TagSelectionGroup (${pattern}): handleTagSelection - newSelectedTags=`, newSelectedTags);
  }, [selectedTags, onSelectionChange, pattern]);


  useEffect(() => {
    async function fetchAndProcessTags() {
      const fetchedTags = await getTagsByName(pattern);
      setTags(fetchedTags);
      console.log(`TagSelectionGroup (${pattern}): fetchedTags=`, fetchedTags);

      const tree = buildTagTree(fetchedTags, pattern);
      setTagTree(tree);
      console.log(`TagSelectionGroup (${pattern}): tagTree=`, tree);

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
      traverseAndCollectSelectable(tree);

      // Pre-select tags based on suggestions, ensuring they are selectable leaf nodes
      if (suggestedTagNames && suggestedTagNames.length > 0) {
        const suggested = fetchedTags.filter(t =>
          suggestedTagNames.includes(t.name) && allSelectableTagNames.includes(t.name)
        );
        setSelectedTags(suggested);
        onSelectionChange(suggested);
        console.log(`TagSelectionGroup (${pattern}): pre-selected tags=`, suggested);
      } else {
        setSelectedTags([]); // Clear selection if no suggestions
        onSelectionChange([]);
        console.log(`TagSelectionGroup (${pattern}): No suggestions or empty, clearing selection.`);
      }
    }
    fetchAndProcessTags();
  }, [pattern, componentKey, suggestedTagNames, onSelectionChange]); // Added suggestedTagNames and onSelectionChange to dependencies


  return (
    <Accordion type="multiple" className="w-full">
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