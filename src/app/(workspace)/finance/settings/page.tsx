import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { financeSettings } from "@/modules/finance/infrastructure/repository";
import { requirePage } from "@/shared/auth/account";

export default async function FinanceSettingsPage() {
  await requirePage("FINANCE_SETTINGS_MANAGE");
  const { profile, accounts } = await financeSettings();
  return <><PageHeading eyebrow="FINANCE SETTINGS" title="세금계산서 · 수금 설정" description="세금계산서에 인쇄되는 공급자 정보와 청구서에 안내할 입금계좌를 관리합니다." />
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>공급자 세무정보</CardTitle></CardHeader><CardContent><CommandForm endpoint="/api/project-finance" action="company_tax_profile.save" constants={profile ? { version: profile.version } : {}} columns={1} fields={[
        { name: "business_registration_number", label: "사업자등록번호 (10자리)", value: profile?.business_registration_number, required: true },
        { name: "company_name", label: "상호", value: profile?.company_name, required: true }, { name: "representative_name", label: "대표자", value: profile?.representative_name, required: true },
        { name: "address", label: "사업장 주소", value: profile?.address, required: true }, { name: "business_type", label: "업태", value: profile?.business_type, required: true },
        { name: "business_item", label: "종목", value: profile?.business_item, required: true }, { name: "email", label: "공급자 이메일", type: "email", value: profile?.email ?? "" },
        { name: "phone", label: "전화번호", value: profile?.phone },
      ]} submit="공급자 정보 저장" /></CardContent></Card>
      <div className="space-y-6"><Card><CardHeader><CardTitle>수금계좌 추가</CardTitle></CardHeader><CardContent><CommandForm endpoint="/api/project-finance" action="bank_account.save" columns={1} fields={[
        { name: "bank_name", label: "은행", required: true }, { name: "account_number", label: "계좌번호", required: true }, { name: "account_holder", label: "예금주", required: true },
        { name: "purpose", label: "용도", value: "수금계좌" }, { name: "is_default", label: "기본 수금계좌", type: "checkbox", value: !accounts.length }, { name: "note", label: "비고", type: "textarea" },
      ]} submit="계좌 추가" /></CardContent></Card>
      <Card><CardHeader><CardTitle>등록 계좌</CardTitle></CardHeader><CardContent className="space-y-3">{accounts.map((account) => <div key={account.id} className="rounded-md border p-4 text-sm"><div className="flex justify-between gap-4"><p className="font-semibold">{account.bank_name} {account.account_number}</p><span>{account.is_default ? "기본" : account.active ? "사용" : "중지"}</span></div><p className="mt-1 text-muted-foreground">예금주 {account.account_holder} · {account.purpose}</p></div>)}{!accounts.length && <p className="text-sm text-muted-foreground">등록된 계좌가 없습니다.</p>}</CardContent></Card></div>
    </div></>;
}
