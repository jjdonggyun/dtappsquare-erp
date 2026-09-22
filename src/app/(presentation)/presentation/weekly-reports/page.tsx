import {requireAnyPage} from "@/shared/auth/account";
import {dateInTimeZone} from "@/shared/domain/date-time";
import {environment} from "@/shared/infrastructure/env";
import {mondayOf} from "@/modules/work-management/domain/week";
import {weeklyReports,weeklyRoster} from "@/modules/work-management/infrastructure/repository";
import {organizationCatalogs} from "@/modules/organization/infrastructure/repository";
import {WeeklyPresentation} from "@/components/weekly-presentation";
export default async function WeeklyPresentationPage({searchParams}:{searchParams:Promise<{week?:string}>}){await requireAnyPage(["WEEKLY_REPORT_READ_TEAM","WEEKLY_REPORT_READ_ALL"]);const query=await searchParams;const today=dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE);const week=mondayOf(query.week&&/^\d{4}-\d{2}-\d{2}$/.test(query.week)&&Number.isFinite(Date.parse(query.week))?query.week:today);const [roster,reports,catalogs]=await Promise.all([weeklyRoster(week),weeklyReports(week),organizationCatalogs()]);return <WeeklyPresentation week={week} roster={roster} reports={reports} organizations={catalogs.organizations}/>}
