import {notFound} from "next/navigation";
import {requireAnyPage} from "@/shared/auth/account";
import {projectDetail,projectPlanning} from "@/modules/project/infrastructure/repository";
import {organizationCatalogs} from "@/modules/organization/infrastructure/repository";
import {serverClient} from "@/shared/infrastructure/supabase/server";
import {databaseError} from "@/shared/domain/errors";
import {dateInTimeZone} from "@/shared/domain/date-time";
import {environment} from "@/shared/infrastructure/env";
import {PageHeading} from "@/components/page-heading";
import {ProjectDetail} from "@/components/project-detail";
import {addDays,dateNumber} from "@/modules/project-resource/domain/metrics";
import {projectWorkLogs} from "@/modules/work-management/infrastructure/repository";
import {cardCatalog,projectExpenses,projectExpenseSummary} from "@/modules/corporate-card/infrastructure/repository";
import {skillCatalog,staffingForProject} from "@/modules/workforce-profile/infrastructure/repository";
export default async function ProjectDetailPage({params}:{params:Promise<{id:string}>}){
  const account=await requireAnyPage(["PROJECT_READ","PROJECT_READ_ALL"]);const {id}=await params;
  const [data,catalogs,planning]=await Promise.all([projectDetail(id),organizationCatalogs(),projectPlanning(id)]);
  if(!data)notFound();
  const canWrite=account.permissions.includes("PROJECT_WRITE")&&(account.permissions.includes("PROJECT_READ_ALL")||data.project.project_manager_id===account.id);
  const canAssign=account.permissions.includes("PROJECT_RESOURCE_MANAGE")&&(account.permissions.includes("PROJECT_READ_ALL")||data.project.project_manager_id===account.id);
  const searchEnd=dateNumber(data.project.planned_end_date)-dateNumber(data.project.planned_start_date)>179?addDays(data.project.planned_start_date,179):data.project.planned_end_date;
  const client=await serverClient();const capacityResult=canAssign?await client.rpc("resource_capacity",{p_start:data.project.planned_start_date,p_end:searchEnd,p_granularity:"range"}):null;
  if(capacityResult?.error)throw databaseError(capacityResult.error);
  const capacity=capacityResult?.data??[];
  const workLogs=account.permissions.includes("WORK_LOG_READ_PROJECT")||account.permissions.includes("WORK_LOG_READ_ALL")||account.permissions.includes("WORK_LOG_READ_SELF")?await projectWorkLogs(id,addDays(dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE),-365),dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE)):[];
  const canReadExpenses=account.permissions.includes("EXPENSE_READ_PROJECT")||account.permissions.includes("EXPENSE_READ_ALL");
  const expenseData=canReadExpenses?await Promise.all([cardCatalog(),projectExpenses(id),projectExpenseSummary(id,dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE).slice(0,7)+"-01")]):null;
  const staffing=account.permissions.includes("PROJECT_STAFFING_READ")?await staffingForProject(id):null;
  const skills=staffing?await skillCatalog():[];
  return <><PageHeading eyebrow="PROJECT DETAIL" title={data.project.project_name} description={`${data.project.project_code} · ${data.project.customer_name}`}/>
    <ProjectDetail project={data.project} assignments={data.assignments} tasks={planning.tasks} milestones={planning.milestones} issues={planning.issues} workLogs={workLogs} expenseData={expenseData} canWriteExpense={account.permissions.includes("EXPENSE_WRITE_SELF")||account.permissions.includes("EXPENSE_MANAGE")} canManageExpense={account.permissions.includes("EXPENSE_MANAGE")} staffing={staffing} skills={skills} canManageStaffing={account.permissions.includes("PROJECT_STAFFING_MANAGE")} canSearchStaffing={account.permissions.includes("WORKFORCE_PROFILE_STAFFING_READ")} canExportProfiles={account.permissions.includes("WORKFORCE_PROFILE_EXPORT_ALL")||account.permissions.includes("WORKFORCE_PROFILE_EXPORT_TEAM")} people={catalogs.directory} organizations={catalogs.organizations} positions={catalogs.positions} titles={catalogs.titles} capacity={capacity} searchEnd={searchEnd} canWrite={canWrite} canAssign={canAssign} canReadAll={account.permissions.includes("PROJECT_READ_ALL")} accountId={account.id} today={dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE)}/></>;
}
