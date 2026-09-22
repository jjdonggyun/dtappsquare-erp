import {mkdtemp,cp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {describe,it,expect} from "vitest";
import {validateMasterData} from "../scripts/validate-master-data.mjs";
describe("Phase 11 master data dry run",()=>{
 it("validates business references and warns on overlapping allocation without writing data",async()=>{
  const directory=await mkdtemp(join(tmpdir(),"erp-master-data-"));
  try{
   await cp(resolve("docs/templates/master-data"),directory,{recursive:true});
   const append=async(file:string,rows:string[])=>writeFile(join(directory,file),`${await readFile(join(directory,file),"utf8")}${rows.join("\n")}\n`);
   await append("organizations.csv",["ORG,Digital Square,,,COMPANY,true"]);
   await append("positions.csv",["SENIOR,Senior,1,true"]);
   await append("titles.csv",["DEV,Developer,1,true"]);
   await append("employees.csv",["E001,Hong,hong@example.test,,2026-01-01,,ORG,SENIOR,DEV,FULL_TIME,ACTIVE"]);
   await append("projects.csv",["P001,Project One,Customer,E001,2026-10-01,2026-12-31,IN_PROGRESS,",
    "P002,Project Two,Customer,E001,2026-10-01,2026-12-31,IN_PROGRESS,"]);
   await append("project_assignments.csv",["P001,E001,Developer,2026-10-01,2026-10-31,70,IN_PROGRESS,",
    "P002,E001,Developer,2026-10-01,2026-10-31,50,IN_PROGRESS,"]);
   let result=await validateMasterData(directory);expect(result.errors).toBe(0);expect(result.warnings).toBeGreaterThan(0);
   await append("employees.csv",["E002,Kim,kim@example.test,,2026-02-30,,MISSING,,,FULL_TIME,ACTIVE"]);
   result=await validateMasterData(directory);expect(result.errors).toBeGreaterThan(0);
   expect(result.issues.some(item=>item.column==="organization_code"&&item.level==="ERROR")).toBe(true);
   expect(result.issues.some(item=>item.column==="join_date"&&item.level==="ERROR")).toBe(true);
  }finally{await rm(directory,{recursive:true,force:true})}
 });
});
