import {notFound} from "next/navigation";
import {requireAnyPage} from "@/shared/auth/account";
import {employeeById} from "@/modules/users/infrastructure/repository";
import {organizationCatalogs} from "@/modules/organization/infrastructure/repository";
import {skillCatalog,workforceProfile} from "@/modules/workforce-profile/infrastructure/repository";
import {PageHeading} from "@/components/page-heading";
import {WorkforceProfileView} from "@/components/workforce-profile-view";
import {dateInTimeZone} from "@/shared/domain/date-time";
import {environment} from "@/shared/infrastructure/env";
import {serverClient} from "@/shared/infrastructure/supabase/server";
import {databaseError} from "@/shared/domain/errors";
export default async function WorkforceProfilePage({params}:{params:Promise<{id:string}>}){
 const account=await requireAnyPage(["WORKFORCE_PROFILE_READ_SELF","WORKFORCE_PROFILE_READ_TEAM","WORKFORCE_PROFILE_READ_ALL"]);const {id}=await params;const target=id==="me"?account.id:id;
 const client=await serverClient();const access=await client.rpc("workforce_profile_access",{p_user_id:target});if(access.error)throw databaseError(access.error);if(!access.data)notFound();
 const [employee,catalogs,skills,profile]=await Promise.all([employeeById(target),organizationCatalogs(),skillCatalog(),workforceProfile(target)]);
 if(!employee)notFound();
 // The profile RLS policies enforce the actual leader organization tree. A missing
 // row is normal for a new profile; employee RLS still gates target visibility.
 const canWrite=target===account.id&&account.permissions.includes("WORKFORCE_PROFILE_WRITE_SELF")||account.permissions.includes("WORKFORCE_PROFILE_MANAGE");
 const canExport=target===account.id&&account.permissions.includes("WORKFORCE_PROFILE_EXPORT_SELF")||account.permissions.includes("WORKFORCE_PROFILE_EXPORT_ALL")||account.permissions.includes("WORKFORCE_PROFILE_EXPORT_TEAM");
 return <><PageHeading eyebrow="WORKFORCE PROFILE" title={`${employee.name} 인력프로필`} description="기술, 학력, 자격과 프로젝트 수행경력을 관리합니다."/>
  <WorkforceProfileView employee={employee} data={profile} skills={skills} organization={catalogs.organizations.find(o=>o.id===employee.organization_id)?.name??"—"} position={catalogs.positions.find(p=>p.id===employee.position_id)?.name??"—"} today={dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE)} canWrite={canWrite} canManage={account.permissions.includes("WORKFORCE_PROFILE_MANAGE")} canExport={canExport}/></>;
}
