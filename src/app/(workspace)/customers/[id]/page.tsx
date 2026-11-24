import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPage } from "@/shared/auth/account";
import { customerDetail } from "@/modules/customer/infrastructure/repository";
import { contactTypeLabels, customerStatusLabels } from "@/modules/customer/domain/contracts";
import { customerFields, contactFields } from "@/components/forms/customer-fields";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function CustomerDetailPage({ params }: PageProps<"/customers/[id]">) {
  const account = await requireAnyPage(["CUSTOMER_READ", "CUSTOMER_MANAGE"]);
  const { id } = await params;
  const data = await customerDetail(id);
  if (!data) notFound();
  const { customer, contacts, projects } = data;
  const canManage = account.permissions.includes("CUSTOMER_MANAGE") && customer.status !== "ARCHIVED";
  return (
    <>
      <PageHeading
        eyebrow="CUSTOMER DETAIL"
        title={customer.name}
        description={`${customer.customer_code} · 고객사 거래 관계와 기존 프로젝트 연결 후보를 확인합니다.`}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/customers" className="text-xs text-primary">← 고객사 목록</Link>
        <Badge variant="outline">{customerStatusLabels[customer.status as keyof typeof customerStatusLabels] ?? customer.status}</Badge>
        {customer.business_registration_number && <span className="text-xs text-muted-foreground">사업자등록번호 {customer.business_registration_number}</span>}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>기본정보</CardTitle></CardHeader>
          <CardContent>
            {canManage ? (
              <CommandForm
                endpoint="/api/customer"
                action="customer.save"
                constants={{ id: customer.id, version: customer.version }}
                fields={customerFields(customer)}
                submit="고객사 저장"
              />
            ) : (
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">대표자</dt><dd className="mt-1">{customer.representative_name ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">업태 · 종목</dt><dd className="mt-1">{[customer.business_type, customer.business_item].filter(Boolean).join(" · ") || "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">주소</dt><dd className="mt-1">{customer.address || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">세금계산서</dt><dd className="mt-1">{customer.billing_contact_name || "—"} {customer.billing_email ? `· ${customer.billing_email}` : ""}</dd></div>
                <div><dt className="text-xs text-muted-foreground">결제 조건</dt><dd className="mt-1">{customer.payment_terms || "—"}</dd></div>
              </dl>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          {canManage && (
            <Card>
              <CardHeader><CardTitle>담당자 등록</CardTitle></CardHeader>
              <CardContent>
                <CommandForm endpoint="/api/customer" action="contact.save" constants={{ customer_id: customer.id }} fields={contactFields()} submit="담당자 등록" />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>담당자</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {contacts.map((contact) => (
                <details key={contact.id} className={`rounded-md border p-3 ${contact.active ? "" : "opacity-60"}`}>
                  <summary className="cursor-pointer text-sm font-semibold">
                    {contact.name} · {contactTypeLabels[contact.contact_type as keyof typeof contactTypeLabels] ?? contact.contact_type}
                    {contact.is_primary && <Badge className="ml-2">대표</Badge>}
                  </summary>
                  <p className="mt-2 text-xs text-muted-foreground">{[contact.department, contact.position, contact.phone, contact.email].filter(Boolean).join(" · ") || "연락 정보 없음"}</p>
                  {canManage && (
                    <div className="mt-4 border-t pt-4">
                      <CommandForm endpoint="/api/customer" action="contact.save" constants={{ id: contact.id, customer_id: customer.id, version: contact.version }} fields={contactFields(contact)} submit="담당자 저장" />
                    </div>
                  )}
                </details>
              ))}
              {!contacts.length && <p className="py-6 text-center text-sm text-muted-foreground">등록된 담당자가 없습니다.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>프로젝트 관계</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">정식 고객사 FK로 연결된 프로젝트와, 기존 고객사명이 정확히 일치하는 미연결 프로젝트 후보입니다. 후보는 자동 병합하지 않습니다.</p>
          <Table>
            <TableHeader><TableRow>{['프로젝트', '기간', '상태', '연결'].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell><Link href={`/projects/${project.id}`} className="font-semibold text-primary hover:underline">{project.project_code} · {project.project_name}</Link></TableCell>
                  <TableCell>{project.planned_start_date} ~ {project.planned_end_date}</TableCell>
                  <TableCell>{project.status}</TableCell>
                  <TableCell><Badge variant={project.customer_id ? "secondary" : "outline"}>{project.customer_id ? "정식 연결" : "Legacy 후보"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!projects.length && <p className="py-8 text-center text-sm text-muted-foreground">연결된 프로젝트가 없습니다.</p>}
        </CardContent>
      </Card>
      {canManage && (
        <Card className="mt-6 border-destructive/25">
          <CardHeader><CardTitle>고객사 보관</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-muted-foreground">기존 거래와 감사 이력은 삭제하지 않고, 신규 업무에서 선택하지 못하도록 보관합니다.</p>
            <CommandForm endpoint="/api/customer" action="customer.archive" constants={{ id: customer.id, version: customer.version }} fields={[]} submit="고객사 보관" />
          </CardContent>
        </Card>
      )}
    </>
  );
}
