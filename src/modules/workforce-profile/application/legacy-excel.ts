import ExcelJS from "exceljs";
export type LegacyEntry={projectName:string;period:string;responsibilities:string;role:string;category:string};
export type LegacyProfile={name:string;birthDate:string;careerText:string;organization:string;highestSchool:string;major:string;skills:string[];entries:LegacyEntry[]};
const value=(cell:ExcelJS.Cell)=>{const raw=cell.value;if(raw===null||raw===undefined)return "";if(raw instanceof Date)return raw.toISOString().slice(0,10);if(typeof raw==="object")return "text" in raw?String(raw.text):"result" in raw?String(raw.result??""):"";return String(raw).trim()};
export function parseLegacyWorkforceSheet(sheet:ExcelJS.Worksheet){
 const issues:{row:number;column:string;message:string}[]=[];const get=(address:string)=>value(sheet.getCell(address));
 const profile:LegacyProfile={name:get("B2"),birthDate:get("D2"),careerText:get("F2"),organization:get("B3"),highestSchool:get("D3"),major:get("F3"),skills:get("B4").split(/[,\n]/).map(x=>x.trim()).filter(Boolean),entries:[]};
 if(!profile.name)issues.push({row:2,column:"B",message:"성명이 비어 있습니다."});
 if(profile.birthDate&&!/^(?:\d{4}[-.]\d{2}[-.]\d{2})$/.test(profile.birthDate))issues.push({row:2,column:"D",message:"생년월일 형식을 확인하세요."});
 if(profile.careerText&&!/^\d+년(?:\s*\d+개월)?$/.test(profile.careerText))issues.push({row:2,column:"F",message:"경력 표기를 확인하세요. 실제 기준일 또는 보정 사유를 수집해야 합니다."});
 for(let row=8;row<=sheet.rowCount;row++){
  const name=get(`B${row}`),period=get(`C${row}`),responsibilities=get(`D${row}`),role=get(`E${row}`),category=get(`A${row}`);
  if(!name&&!period&&!responsibilities&&!role)continue;
  if(name.includes("프로젝트명")||period.includes("참여기간"))continue;
  if(!name)issues.push({row,column:"B",message:"프로젝트명이 비어 있습니다."});
  if(!period||!/\d{2,4}[.-]\d{1,2}\s*[~～-]\s*(?:\d{2,4}[.-]\d{1,2}|현재)/.test(period))issues.push({row,column:"C",message:"참여기간을 확인하세요."});
  if(!responsibilities)issues.push({row,column:"D",message:"프로젝트 주요 업무가 비어 있습니다."});
  if(!role)issues.push({row,column:"E",message:"역할이 비어 있습니다."});
  profile.entries.push({projectName:name,period,responsibilities,role,category});
 }
 return {profile,issues};
}
