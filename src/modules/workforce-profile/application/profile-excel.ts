import ExcelJS from "exceljs";
import {careerLabel,careerMonths} from "../domain/contracts";

export type ProfileExport={name:string;organization:string;birthDate:string|null;careerStartDate:string|null;careerMonthsOverride:number|null;highestSchool:string;major:string;skills:string[];experiences:{category:string;name:string;start:string|null;end:string|null;responsibilities:string;role:string}[]};
const safe=(value:string)=>/^[=+\-@\t\r]/.test(value)?`'${value}`:value;
const period=(start:string|null,end:string|null)=>{const short=(v:string)=>v.slice(2,7).replace("-",".");return start?`${short(start)} ~ ${end?short(end):"현재"}`:"—"};
export async function buildWorkforceProfileExcel(profiles:ProfileExport[],today:string){
 const book=new ExcelJS.Workbook();book.creator="Digital Square ERP";
 profiles.forEach((profile,index)=>{
  const sheet=book.addWorksheet(`${String(index+1).padStart(2,"0")}_${profile.name.replace(/[\\/*?:\[\]]/g,"").slice(0,20)}`);
  sheet.columns=[{width:15},{width:36},{width:18},{width:57},{width:16},{width:20}];
  const put=(cell:string,value:string)=>{sheet.getCell(cell).value=safe(value)};
  // Six columns follow the supplied form; label and value cells stay separate.
  put("A2","성  명");put("B2",profile.name);put("C2","생년월일");put("D2",profile.birthDate??"—");put("E2","업무경력 (년.월)");put("F2",careerLabel(careerMonths(profile.careerStartDate,profile.careerMonthsOverride,today)));
  put("A3","소  속");put("B3",profile.organization);put("C3","최종학교");put("D3",profile.highestSchool);put("E3","전공");put("F3",profile.major);
  put("A4","보유 기술");sheet.mergeCells("B4:F4");put("B4",profile.skills.join(", ")||"—");
  sheet.getRow(6).height=9;
  ["구  분","프로젝트명","참여기간 (최신순)","프로젝트 주요 업무","역할",""].forEach((label,i)=>{sheet.getRow(7).getCell(i+1).value=label});
  const ordered=[...profile.experiences].sort((a,b)=>(b.start??"").localeCompare(a.start??""));
  ordered.forEach((x,i)=>{const row=sheet.getRow(8+i);[x.category,x.name,period(x.start,x.end),x.responsibilities,x.role,""].forEach((v,j)=>row.getCell(j+1).value=safe(v));row.height=Math.max(34,Math.min(120,Math.ceil(x.responsibilities.length/55)*18));});
  for(let r=2;r<=Math.max(7,7+ordered.length);r++){
   const row=sheet.getRow(r);if(r!==6)for(let c=1;c<=6;c++){const cell=row.getCell(c);cell.border={top:{style:"thin",color:{argb:"FF262626"}},bottom:{style:"thin",color:{argb:"FF262626"}},left:{style:"thin",color:{argb:"FF262626"}},right:{style:"thin",color:{argb:"FF262626"}}};cell.alignment={vertical:"middle",horizontal:c===4&&r>=8?"left":"center",wrapText:true};}
  }
  for(const address of ["A2","C2","E2","A3","C3","E3","A4"]){const cell=sheet.getCell(address);cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE3F0F8"}};cell.font={bold:true};}
  for(let c=1;c<=6;c++){const cell=sheet.getRow(7).getCell(c);cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFECF8F2"}};cell.font={bold:true};}
  sheet.getRow(2).height=26;sheet.getRow(3).height=26;sheet.getRow(4).height=28;sheet.getRow(7).height=34;
  sheet.views=[{state:"frozen",ySplit:7}];sheet.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};
 });
 return Buffer.from(await book.xlsx.writeBuffer());
}
