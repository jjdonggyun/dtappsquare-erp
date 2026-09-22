import {requirePage} from "@/shared/auth/account";
import {dateInTimeZone} from "@/shared/domain/date-time";
import {environment} from "@/shared/infrastructure/env";
import {mondayOf} from "@/modules/work-management/domain/week";
import {weeklyReports,weeklyRoster} from "@/modules/work-management/infrastructure/repository";
import {organizationCatalogs} from "@/modules/organization/infrastructure/repository";
import {PageHeading} from "@/components/page-heading";
import {WeeklyReportClient} from "@/components/weekly-report-client";
export default async function WeeklyReportsPage({searchParams}:{searchParams:Promise<{week?:string}>}){const account=await requirePage("WEEKLY_REPORT_READ_SELF");const query=await searchParams;const today=dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE);const week=mondayOf(query.week&&/^\d{4}-\d{2}-\d{2}$/.test(query.week)&&Number.isFinite(Date.parse(query.week))?query.week:today);const [reports,roster,catalogs]=await Promise.all([weeklyReports(week),weeklyRoster(week),organizationCatalogs()]);return <><PageHeading eyebrow="WEEKLY REPORT" title="주간보고" description="모든 직원의 월요일~금요일 업무를 정리하고 확정합니다."/><WeeklyReportClient week={week} roster={roster} reports={reports} organizations={catalogs.organizations} accountId={account.id} canWrite={account.permissions.includes("WEEKLY_REPORT_WRITE_SELF")} canReadTeam={account.permissions.includes("WEEKLY_REPORT_READ_TEAM")||account.permissions.includes("WEEKLY_REPORT_READ_ALL")}/></>}
