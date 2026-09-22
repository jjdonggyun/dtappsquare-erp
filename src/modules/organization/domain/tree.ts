import { z } from "zod";
export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  organization_type: z.string(),
  parent_id: z.uuid().nullable(),
  leader_user_id: z.uuid().nullable(),
  sort_order: z.number(),
  active: z.boolean(),
});
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationNode = Organization & { children: OrganizationNode[] };
export function organizationTree(rows: Organization[]): OrganizationNode[] {
  const nodes = new Map(rows.map((row) => [row.id, { ...row, children: [] } as OrganizationNode]));
  const roots: OrganizationNode[] = [];
  for (const node of nodes.values()) {
    const visited = new Set([node.id]);
    let parent = node.parent_id;
    while (parent) {
      if (visited.has(parent)) throw new Error("Organization cycle");
      visited.add(parent);
      parent = nodes.get(parent)?.parent_id ?? null;
    }
    if (node.parent_id && nodes.has(node.parent_id)) nodes.get(node.parent_id)!.children.push(node);
    else roots.push(node);
  }
  const sort = (items: OrganizationNode[]) => {
    items.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    items.forEach((item) => sort(item.children));
  };
  sort(roots);
  return roots;
}
