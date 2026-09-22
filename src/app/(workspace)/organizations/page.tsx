import { requirePage } from "@/shared/auth/account";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { organizationTree, type OrganizationNode } from "@/modules/organization/domain/tree";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Network, UserRound } from "lucide-react";
type Person = { id: string; name: string; organization_id: string | null };
function Branch({ nodes, people }: { nodes: OrganizationNode[]; people: Person[] }) {
  return (
    <ul className="space-y-3 border-l pl-5">
      {nodes.map((node) => (
        <li key={node.id}>
          <details open>
            <summary className="rounded-lg bg-muted/50 p-4 text-sm font-medium">
              <Network className="mr-2 inline size-4 text-primary" />
              {node.name}
              <span className="ml-3 text-xs text-muted-foreground">
                {people.find((p) => p.id === node.leader_user_id)?.name ?? "리더 미지정"}
              </span>
            </summary>
            <div className="py-3 pl-5">
              {people
                .filter((p) => p.organization_id === node.id)
                .map((person) => (
                  <p key={person.id} className="mb-2 text-sm text-muted-foreground">
                    <UserRound className="mr-2 inline size-3" />
                    {person.name}
                  </p>
                ))}
              {node.children.length > 0 && <Branch nodes={node.children} people={people} />}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
export default async function Organizations() {
  await requirePage();
  const data = await organizationCatalogs();
  return (
    <>
      <PageHeading
        eyebrow="ORGANIZATION"
        title="조직도"
        description="Digital Square의 조직과 구성원을 확인하세요."
      />
      <Card>
        <CardContent className="py-8">
          <Branch
            nodes={organizationTree(data.organizations.filter((o) => o.active))}
            people={data.directory}
          />
        </CardContent>
      </Card>
    </>
  );
}
