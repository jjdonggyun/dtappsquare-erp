import {dateInTimeZone} from "@/shared/domain/date-time";
import {environment} from "@/shared/infrastructure/env";
import {requirePage} from "@/shared/auth/account";
import {projectCatalog,resourcePeriod} from "@/modules/project/infrastructure/repository";
import {organizationCatalogs} from "@/modules/organization/infrastructure/repository";
import {addDays,dateNumber} from "@/modules/project-resource/domain/metrics";
import {PageHeading} from "@/components/page-heading";
import {ResourceDashboard} from "@/components/resource-dashboard";
export default async function ResourcePlanningPage({searchParams}:{searchParams:Promise<{start?:string;end?:string;granularity?:string}>}){
  await requirePage("RESOURCE_READ");const query=await searchParams;
  const today=dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE);const defaultStart=`${today.slice(0,7)}-01`;
  const valid=(date?:string)=>!!date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(dateNumber(date));
  const start=valid(query.start)?query.start!:defaultStart;
  const candidate=valid(query.end)?query.end!:addDays(start,179);
  const end=Number.isFinite(dateNumber(candidate))&&dateNumber(candidate)>=dateNumber(start)&&dateNumber(candidate)-dateNumber(start)<=185?candidate:addDays(start,179);
  const granularity=query.granularity==="week"?"week":"month";
  const [data,catalogs,period]=await Promise.all([projectCatalog(),organizationCatalogs(),resourcePeriod(start,end,granularity)]);
  return <><PageHeading eyebrow="RESOURCE PLANNING" title="투입현황" description={`${today} 기준 · 전체 직원의 가용률과 프로젝트 투입 일정을 확인합니다.`}/>
    <ResourceDashboard people={catalogs.directory} organizations={catalogs.organizations} positions={catalogs.positions} projects={data.projects} assignments={period.allocations} capacity={period.capacity??[]} leave={period.leave??[]} today={today} start={start} end={end} granularity={granularity}/></>;
}
