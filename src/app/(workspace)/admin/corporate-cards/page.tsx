import {requireAnyPage} from "@/shared/auth/account";
import {cardCatalog} from "@/modules/corporate-card/infrastructure/repository";
import {projectCatalog} from "@/modules/project/infrastructure/repository";
import {organizationCatalogs} from "@/modules/organization/infrastructure/repository";
import {PageHeading} from "@/components/page-heading";
import {CorporateCardClient} from "@/components/corporate-card-client";
export default async function CorporateCardsPage(){const account=await requireAnyPage(["CORPORATE_CARD_READ","CORPORATE_CARD_MANAGE"]);const [data,projects,people]=await Promise.all([cardCatalog(),projectCatalog(),organizationCatalogs()]);return <><PageHeading eyebrow="CORPORATE CARD" title="법인카드" description="카드 기본 정보와 프로젝트별 할당 이력을 관리합니다. 전체 카드번호는 저장하지 않습니다."/><CorporateCardClient {...data} projects={projects.projects} people={people.directory} canManage={account.permissions.includes("CORPORATE_CARD_MANAGE")}/></>}
