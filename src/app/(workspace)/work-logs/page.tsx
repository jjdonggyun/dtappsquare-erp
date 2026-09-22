import {requirePage} from "@/shared/auth/account";
import {projectCatalog,projectTasksForProjects} from "@/modules/project/infrastructure/repository";
import {workLogs} from "@/modules/work-management/infrastructure/repository";
import {shiftDays} from "@/modules/work-management/domain/week";
import {dateInTimeZone} from "@/shared/domain/date-time";
import {environment} from "@/shared/infrastructure/env";
import {PageHeading} from "@/components/page-heading";
import {WorkLogClient} from "@/components/work-log-client";
export default async function WorkLogsPage({searchParams}:{searchParams:Promise<{date?:string}>}){const account=await requirePage("WORK_LOG_READ_SELF");const query=await searchParams;const today=dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE);const date=query.date&&/^\d{4}-\d{2}-\d{2}$/.test(query.date)&&Number.isFinite(Date.parse(query.date))?query.date:today;const previous=shiftDays(date,-1);
 const [logs,yesterday,catalog]=await Promise.all([workLogs(date,date,account.id),workLogs(previous,previous,account.id),projectCatalog()]);
 const tasks=await projectTasksForProjects(catalog.projects.map(p=>p.id));
 return <><PageHeading eyebrow="DAILY WORK" title="업무일지" description="프로젝트와 사내업무를 매일 빠르게 기록합니다. 근태와 별도로 관리됩니다."/><WorkLogClient date={date} logs={logs} yesterday={yesterday} projects={catalog.projects} tasks={tasks} canWrite={account.permissions.includes("WORK_LOG_WRITE_SELF")}/></>;
}
