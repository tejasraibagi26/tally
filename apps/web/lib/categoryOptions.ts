export interface CategoryOptionSource {
  id: string;
  name: string;
  colorSlot: number;
  parentId: string | null;
  sortOrder: number;
}

export interface GroupedCategoryOption {
  id: string;
  name: string;
  colorSlot: number;
  indent: boolean;
}

/**
 * Orders categories parent-then-its-children (rather than a flat
 * alphabetical list) so a picker reads as "Medical" with "Dental care",
 * "Eye care", … nested under it, instead of every subcategory competing
 * alphabetically with unrelated top-level categories.
 */
export function groupCategoryOptions(categories: CategoryOptionSource[]): GroupedCategoryOption[] {
  const byParent = new Map<string, CategoryOptionSource[]>();
  const parents: CategoryOptionSource[] = [];
  for (const c of categories) {
    if (c.parentId) {
      byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
    } else {
      parents.push(c);
    }
  }
  parents.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  for (const kids of byParent.values()) kids.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const result: GroupedCategoryOption[] = [];
  for (const p of parents) {
    result.push({ id: p.id, name: p.name, colorSlot: p.colorSlot, indent: false });
    for (const child of byParent.get(p.id) ?? []) {
      result.push({ id: child.id, name: child.name, colorSlot: child.colorSlot, indent: true });
    }
  }
  return result;
}

/** All descendant category ids for a given category id, including itself — used to roll a parent-category filter up over its children. */
export function categoryIdsInGroup(categoryId: string, categories: { id: string; parentId: string | null }[]): string[] {
  const childIds = categories.filter((c) => c.parentId === categoryId).map((c) => c.id);
  return childIds.length ? [categoryId, ...childIds] : [categoryId];
}
