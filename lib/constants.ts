export const searchModes = [
  { mode: 'all', label: 'すべて' },
  { mode: 'main_dish', label: '主菜' },
  { mode: 'sub_dish', label: '副菜' },
  { mode: 'others', label: 'その他' },
];

export const ITEMS_PER_PAGE = 12;

export function calculateNextOffset(currentOffset: number): number {
  return currentOffset + ITEMS_PER_PAGE;
}