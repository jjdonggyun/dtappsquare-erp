import {readFile,readdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import {isIP} from "node:net";
import {pathToFileURL} from "node:url";

const columns={
 "organizations.csv":"organization_code,organization_name,parent_code,leader_employee_number,type,active",
 "positions.csv":"position_code,position_name,sort_order,active",
 "titles.csv":"title_code,title_name,sort_order,active",
 "employees.csv":"employee_number,name,email,phone,join_date,resignation_date,organization_code,position_code,title_code,employment_type,status",
 "roles.csv":"role_code,role_name,active",
 "employee_roles.csv":"employee_number,role_code",
 "work_policies.csv":"work_policy_code,work_policy_name,check_in_time,check_out_time,break_start,break_end,late_grace_minutes,timezone,working_days",
 "work_policy_assignments.csv":"employee_number,work_policy_code,effective_from,effective_to",
 "assets.csv":"asset_code,asset_type,manufacturer,model,serial_number,purchase_date,warranty_end_date,status",
 "asset_assignments.csv":"asset_code,employee_number,assigned_at,memo",
 "projects.csv":"project_code,project_name,customer_name,pm_employee_number,planned_start_date,planned_end_date,status,description",
 "project_assignments.csv":"project_code,employee_number,role,planned_start_date,planned_end_date,allocation_rate,status,memo",
 "attendance_networks.csv":"network_name,cidr,active",
 "workforce_profiles.csv":"employee_number,birth_date,career_start_date,career_months_override,career_override_reason,summary,profile_status",
 "workforce_educations.csv":"employee_number,school_name,degree,major,start_date,end_date,graduation_status,highest_education,sort_order",
 "skills.csv":"skill_code,skill_name,category,active",
 "employee_skills.csv":"employee_number,skill_code,level,years_experience,last_used_date,memo",
 "workforce_certifications.csv":"employee_number,certification_name,issuer,obtained_date,expiry_date,credential_id",
 "workforce_project_experiences.csv":"employee_number,source_type,project_code,assignment_start_date,project_name,customer_name,category,start_date,end_date,role,responsibilities,technologies,sort_order",
 "project_staffing_requirements.csv":"requirement_key,project_code,role_name,required_headcount,planned_start_date,planned_end_date,allocation_rate,description,lifecycle_status",
 "project_staffing_skills.csv":"requirement_key,skill_code,preference,target_level",
};
const required={
 "organizations.csv":["organization_code","organization_name","type","active"],
 "positions.csv":["position_code","position_name","sort_order","active"],
 "titles.csv":["title_code","title_name","sort_order","active"],
 "employees.csv":["employee_number","name","email","join_date","organization_code","employment_type","status"],
 "roles.csv":["role_code","role_name","active"],
 "employee_roles.csv":["employee_number","role_code"],
 "work_policies.csv":["work_policy_code","work_policy_name","check_in_time","check_out_time","late_grace_minutes","timezone","working_days"],
 "work_policy_assignments.csv":["employee_number","work_policy_code","effective_from"],
 "assets.csv":["asset_code","asset_type","status"],
 "asset_assignments.csv":["asset_code","employee_number","assigned_at"],
 "projects.csv":["project_code","project_name","customer_name","pm_employee_number","planned_start_date","planned_end_date","status"],
 "project_assignments.csv":["project_code","employee_number","role","planned_start_date","planned_end_date","allocation_rate","status"],
 "attendance_networks.csv":["network_name","cidr","active"],
 "workforce_profiles.csv":["employee_number","profile_status"],
 "workforce_educations.csv":["employee_number","school_name","graduation_status","highest_education"],
 "skills.csv":["skill_code","skill_name","category","active"],
 "employee_skills.csv":["employee_number","skill_code"],
 "workforce_certifications.csv":["employee_number","certification_name"],
 "workforce_project_experiences.csv":["employee_number","source_type","responsibilities"],
 "project_staffing_requirements.csv":["requirement_key","project_code","role_name","required_headcount","planned_start_date","planned_end_date","allocation_rate","lifecycle_status"],
 "project_staffing_skills.csv":["requirement_key","skill_code","preference"],
};
const uniqueKeys={"organizations.csv":"organization_code","positions.csv":"position_code","titles.csv":"title_code","employees.csv":"employee_number","roles.csv":"role_code","work_policies.csv":"work_policy_code","assets.csv":"asset_code","projects.csv":"project_code","attendance_networks.csv":"network_name","workforce_profiles.csv":"employee_number","skills.csv":"skill_code","project_staffing_requirements.csv":"requirement_key"};
const enumerations={
 type:["COMPANY","DIVISION","TEAM","DEPARTMENT"],employment_type:["FULL_TIME","CONTRACT","PART_TIME","INTERN"],
 status:{"employees.csv":["REQUESTED","ACTIVE","SUSPENDED","RESIGNED"],"assets.csv":["AVAILABLE","ASSIGNED","IN_USE","REPAIR","LOST","RETURNED","DISPOSED"],
   "projects.csv":["PLANNING","SCHEDULED","IN_PROGRESS","ON_HOLD","COMPLETED","CANCELED"],"project_assignments.csv":["PLANNED","CONFIRMED","IN_PROGRESS","ON_HOLD","ENDED","CANCELED"]},
 asset_type:["LAPTOP","DESKTOP","MONITOR","PHONE","TABLET","LICENSE","ETC"],
 profile_status:["DRAFT","READY"],graduation_status:["ENROLLED","GRADUATED","COMPLETED","WITHDRAWN"],
 level:["BASIC","INTERMEDIATE","ADVANCED","EXPERT"],target_level:["BASIC","INTERMEDIATE","ADVANCED","EXPERT"],
 source_type:["INTERNAL_PROJECT","MANUAL_HISTORY"],preference:["REQUIRED","PREFERRED"],
 lifecycle_status:["OPEN","CLOSED"]
};
const builtInRoles=new Set(["EMPLOYEE","TEAM_MANAGER","PROJECT_MANAGER","HR_MANAGER","ASSET_MANAGER","FINANCE_MANAGER","ADMIN"]);
function csvRows(text){const rows=[];let row=[],field="",quoted=false;for(let i=0;i<text.length;i++){
 const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
 else if(char===','&&!quoted){row.push(field);field=""}
 else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(value=>value.trim()))rows.push(row);row=[];field=""}
 else field+=char;
 }if(quoted)throw new Error("Unclosed CSV quote");if(field||row.length){row.push(field);if(row.some(value=>value.trim()))rows.push(row)}return rows}
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const dateTime=value=>!Number.isNaN(Date.parse(value))&&/T\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(value);
const nextDay=value=>new Date(Date.parse(`${value}T00:00:00Z`)+86400000).toISOString().slice(0,10);
function cidr(value){const [ip,mask,...extra]=value.split('/');if(extra.length||!isIP(ip))return false;const max=isIP(ip)===4?32:128;return mask!==undefined&&/^\d+$/.test(mask)&&Number(mask)<=max}
export async function validateMasterData(directory){
 const issues=[],data={};let total=0;
 const issue=(level,file,row,column,message)=>issues.push({level,file,row,column,message});
 const entries=new Set(await readdir(directory));
 for(const [file,header] of Object.entries(columns)){
  if(!entries.has(file)){issue("ERROR",file,0,"","Template file is missing");data[file]=[];continue}
  let parsed;try{parsed=csvRows((await readFile(join(directory,file),"utf8")).replace(/^\uFEFF/,""))}catch(error){issue("ERROR",file,0,"",error.message);data[file]=[];continue}
  if(parsed[0]?.join(',')!==header){issue("ERROR",file,1,"","Header must match canonical template exactly");data[file]=[];continue}
  const names=header.split(',');const seen=new Set();data[file]=[];
  for(let i=1;i<parsed.length;i++){
   const cells=parsed[i];if(cells.length!==names.length){issue("ERROR",file,i+1,"","Column count does not match header");continue}
   const row=Object.fromEntries(names.map((name,index)=>[name,cells[index].trim()]));row.__row=i+1;data[file].push(row);total++;
   for(const name of required[file])if(!row[name])issue("ERROR",file,i+1,name,"Required value is empty");
   const key=uniqueKeys[file];if(key&&row[key]){const normalized=row[key].toUpperCase();if(seen.has(normalized))issue("ERROR",file,i+1,key,"Duplicate business key");seen.add(normalized)}
   for(const [name,value] of Object.entries(row)){
    if(!value||name==="__row")continue;
    const choices=enumerations[name]?.[file]??enumerations[name];if(Array.isArray(choices)&&!choices.includes(value))issue("ERROR",file,i+1,name,`Allowed: ${choices.join('|')}`);
    if(name.endsWith("_date")||["join_date","resignation_date","purchase_date","warranty_end_date","effective_from","effective_to","assigned_from","assigned_to","starts_on","ends_on"].includes(name)){
      if(!date(value))issue("ERROR",file,i+1,name,"Use a valid YYYY-MM-DD date");
    }
    if(name==="assigned_at"&&!dateTime(value))issue("ERROR",file,i+1,name,"Use ISO timestamp with timezone");
    if(name==="email"&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))issue("ERROR",file,i+1,name,"Invalid email");
    if(["active","highest_education"].includes(name)&&!["true","false"].includes(value.toLowerCase()))issue("ERROR",file,i+1,name,"Use true or false");
    if(["sort_order","late_grace_minutes","career_months_override","required_headcount"].includes(name)&&!/^\d+$/.test(value))issue("ERROR",file,i+1,name,"Use a nonnegative integer");
    if(name==="years_experience"&&(!/^\d+(?:\.\d)?$/.test(value)||Number(value)>60))issue("ERROR",file,i+1,name,"Use 0-60 years with one decimal");
    if(name==="allocation_rate"&&(!/^\d+(\.\d{1,2})?$/.test(value)||Number(value)>100))issue("ERROR",file,i+1,name,"Use a percentage from 0 to 100 with at most 2 decimals");
    if(["check_in_time","check_out_time","break_start","break_end"].includes(name)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))issue("ERROR",file,i+1,name,"Use HH:MM");
    if(name==="cidr"&&!cidr(value))issue("ERROR",file,i+1,name,"Use a valid IPv4/IPv6 CIDR");
   }
   for(const [start,end] of [["planned_start_date","planned_end_date"],["purchase_date","warranty_end_date"],["effective_from","effective_to"],["start_date","end_date"],["obtained_date","expiry_date"]])if(row[start]&&row[end]&&date(row[start])&&date(row[end])&&row[end]<row[start])issue("ERROR",file,i+1,end,"End date precedes start date");
  }
 }
 const keySet=(file,column)=>new Set(data[file].map(row=>row[column]).filter(Boolean));
 const organizations=keySet("organizations.csv","organization_code"),positions=keySet("positions.csv","position_code"),titles=keySet("titles.csv","title_code"),employees=keySet("employees.csv","employee_number"),
  assets=keySet("assets.csv","asset_code"),projects=keySet("projects.csv","project_code"),policies=keySet("work_policies.csv","work_policy_code"),roles=new Set([...keySet("roles.csv","role_code"),...builtInRoles]),skills=keySet("skills.csv","skill_code"),requirements=keySet("project_staffing_requirements.csv","requirement_key");
 const references={"organizations.csv":{parent_code:organizations,leader_employee_number:employees},"employees.csv":{organization_code:organizations,position_code:positions,title_code:titles},
  "employee_roles.csv":{employee_number:employees,role_code:roles},"work_policy_assignments.csv":{employee_number:employees,work_policy_code:policies},
  "asset_assignments.csv":{asset_code:assets,employee_number:employees},"projects.csv":{pm_employee_number:employees},
  "project_assignments.csv":{project_code:projects,employee_number:employees},
  "workforce_profiles.csv":{employee_number:employees},"workforce_educations.csv":{employee_number:employees},
  "employee_skills.csv":{employee_number:employees,skill_code:skills},"workforce_certifications.csv":{employee_number:employees},
  "workforce_project_experiences.csv":{employee_number:employees,project_code:projects},
  "project_staffing_requirements.csv":{project_code:projects},"project_staffing_skills.csv":{requirement_key:requirements,skill_code:skills}};
 for(const [file,links] of Object.entries(references))for(const row of data[file])for(const [column,known] of Object.entries(links))if(row[column]&&!known.has(row[column]))issue("ERROR",file,row.__row,column,"Reference key is not present in this import batch");
 const orgParents=new Map(data["organizations.csv"].map(row=>[row.organization_code,row.parent_code]));
 for(const row of data["organizations.csv"]){const visited=new Set([row.organization_code]);let parent=row.parent_code;while(parent){if(visited.has(parent)){issue("ERROR","organizations.csv",row.__row,"parent_code","Organization cycle");break}visited.add(parent);parent=orgParents.get(parent)}}
 for(const row of data["employees.csv"])if(row.status==="ACTIVE"&&(!row.employee_number||!row.join_date||!row.organization_code))issue("ERROR","employees.csv",row.__row,"status","ACTIVE employee needs number, join date and organization");
 for(const row of data["employees.csv"])if(row.status==="RESIGNED"&&!row.resignation_date)issue("ERROR","employees.csv",row.__row,"resignation_date","RESIGNED employee needs resignation date");
 for(const row of data["work_policies.csv"])if(Boolean(row.break_start)!==Boolean(row.break_end))issue("ERROR","work_policies.csv",row.__row,"break_start","Both break times are required together");
 const activeAssets=new Set();for(const row of data["asset_assignments.csv"]){if(activeAssets.has(row.asset_code))issue("ERROR","asset_assignments.csv",row.__row,"asset_code","An asset has more than one open assignment");activeAssets.add(row.asset_code)}
 for(const row of data["workforce_profiles.csv"]){if(row.career_months_override&&!row.career_override_reason)issue("ERROR","workforce_profiles.csv",row.__row,"career_override_reason","Career override requires a reason");if(row.career_months_override&&Number(row.career_months_override)>720)issue("ERROR","workforce_profiles.csv",row.__row,"career_months_override","Maximum 720 months")}
 const highest=new Set(),ownedSkills=new Set();
 for(const row of data["workforce_educations.csv"])if(row.highest_education.toLowerCase()==="true"){if(highest.has(row.employee_number))issue("ERROR","workforce_educations.csv",row.__row,"highest_education","Only one highest education per employee");highest.add(row.employee_number)}
 for(const row of data["employee_skills.csv"]){const key=`${row.employee_number}:${row.skill_code}`;if(ownedSkills.has(key))issue("ERROR","employee_skills.csv",row.__row,"skill_code","Duplicate employee skill");ownedSkills.add(key)}
 const assignmentsByKey=new Set(data["project_assignments.csv"].map(row=>`${row.employee_number}:${row.project_code}:${row.planned_start_date}`));
 for(const row of data["workforce_project_experiences.csv"]){
  if(row.source_type==="INTERNAL_PROJECT"){
   if(!row.project_code||!row.assignment_start_date||!assignmentsByKey.has(`${row.employee_number}:${row.project_code}:${row.assignment_start_date}`))issue("ERROR","workforce_project_experiences.csv",row.__row,"project_code","Internal history must match a project assignment in this batch");
   if(row.project_name||row.customer_name||row.start_date||row.end_date||row.role)issue("ERROR","workforce_project_experiences.csv",row.__row,"source_type","Internal project identity must come from assignment");
  }else if(row.source_type==="MANUAL_HISTORY"){
   if(!row.project_name||!row.start_date||!row.role)issue("ERROR","workforce_project_experiences.csv",row.__row,"project_name","Manual history requires project name, start date and role");
   if(row.project_code||row.assignment_start_date)issue("ERROR","workforce_project_experiences.csv",row.__row,"project_code","Manual history cannot link an ERP assignment");
  }
 }
 for(const row of data["project_staffing_requirements.csv"]){if(Number(row.required_headcount)<1||Number(row.required_headcount)>100)issue("ERROR","project_staffing_requirements.csv",row.__row,"required_headcount","Use 1-100");if(date(row.planned_start_date)&&date(row.planned_end_date)&&(Date.parse(row.planned_end_date)-Date.parse(row.planned_start_date))/86400000>185)issue("ERROR","project_staffing_requirements.csv",row.__row,"planned_end_date","Maximum 185 days per requirement")}
 const reqSkills=new Set();for(const row of data["project_staffing_skills.csv"]){const key=`${row.requirement_key}:${row.skill_code}`;if(reqSkills.has(key))issue("ERROR","project_staffing_skills.csv",row.__row,"skill_code","Duplicate requirement skill");reqSkills.add(key)}
 const usage=new Map();for(const row of data["project_assignments.csv"]){if(!["PLANNED","CONFIRMED","IN_PROGRESS"].includes(row.status)||!date(row.planned_start_date)||!date(row.planned_end_date)||!/^\d+(\.\d{1,2})?$/.test(row.allocation_rate))continue;
  const days=usage.get(row.employee_number)??new Map();days.set(row.planned_start_date,(days.get(row.planned_start_date)??0)+Number(row.allocation_rate));const end=nextDay(row.planned_end_date);days.set(end,(days.get(end)??0)-Number(row.allocation_rate));usage.set(row.employee_number,days)}
 for(const [employee,days] of usage){let rate=0;for(const [day,delta] of [...days].sort(([a],[b])=>a.localeCompare(b))){rate+=delta;if(rate>100)issue("WARNING","project_assignments.csv",0,"allocation_rate",`${employee}: ${day} total allocation ${rate}%`)}}
 const errors=issues.filter(item=>item.level==="ERROR").length,warnings=issues.filter(item=>item.level==="WARNING").length;
 return {total,valid:Math.max(0,total-new Set(issues.filter(item=>item.level==="ERROR"&&item.row>1).map(item=>`${item.file}:${item.row}`)).size),warnings,errors,issues};
}
const args=process.argv.slice(2);if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const index=args.indexOf("--dir"),directory=index>=0?args[index+1]:args.find(arg=>!arg.startsWith("--"))??"docs/templates/master-data";
 if(!directory||!args.includes("--dry-run")||args.some(arg=>["--apply","--import"].includes(arg))){
  process.stderr.write("Usage: npm run import:master-data [-- <template-folder>]\nThis Phase 10 command validates only; it never writes to the DB.\n");process.exitCode=2;
 }else{const result=await validateMasterData(resolve(directory));process.stdout.write(`${JSON.stringify(result,null,2)}\n`);if(result.errors)process.exitCode=1}
}
