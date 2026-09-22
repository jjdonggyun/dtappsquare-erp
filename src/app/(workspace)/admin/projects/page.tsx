import {requireAnyPage} from "@/shared/auth/account";
import {projectCatalog} from "@/modules/project/infrastructure/repository";
import {organizationCatalogs} from "@/modules/organization/infrastructure/repository";
import {dateInTimeZone} from "@/shared/domain/date-time";
import {environment} from "@/shared/infrastructure/env";
import {PageHeading} from "@/components/page-heading";
import {ProjectIndex} from "@/components/project-index";
import {projectPortfolioStaffing} from "@/modules/workforce-profile/infrastructure/repository";
export default async function ProjectManagementPage(){
  const account=await requireAnyPage(["PROJECT_READ","PROJECT_READ_ALL"]);
  const [data,catalogs]=await Promise.all([projectCatalog(),organizationCatalogs()]);
  const portfolio=account.permissions.includes("PROJECT_STAFFING_READ")?await projectPortfolioStaffing():[];
  return <><PageHeading eyebrow="PROJECT PORTFOLIO" title="프로젝트 관리" description="프로젝트 일정과 인력 배치를 함께 관리합니다."/>
    <ProjectIndex projects={data.projects} assignments={data.assignments} portfolio={portfolio} people={catalogs.directory} organizations={catalogs.organizations} canWrite={account.permissions.includes("PROJECT_WRITE")} canReadAll={account.permissions.includes("PROJECT_READ_ALL")} accountId={account.id} today={dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE)}/></>;
}
