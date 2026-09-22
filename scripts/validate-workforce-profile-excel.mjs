import ExcelJS from "exceljs";
import {parseLegacyWorkforceSheet} from "../src/modules/workforce-profile/application/legacy-excel.ts";
import {resolve} from "node:path";
const args=process.argv.slice(2),file=args.find(x=>!x.startsWith("--"));
if(!file||!args.includes("--dry-run")||args.includes("--apply")){process.stderr.write("Usage: npm run import:workforce-profile -- C:\\private\\profile.xlsx --dry-run\nNo DB writes are supported.\n");process.exitCode=2}
else{const book=new ExcelJS.Workbook();await book.xlsx.readFile(resolve(file));let projects=0,skills=0;const issues=[];for(let i=0;i<book.worksheets.length;i++){const result=parseLegacyWorkforceSheet(book.worksheets[i]);projects+=result.profile.entries.length;skills+=result.profile.skills.length;issues.push(...result.issues.map(x=>({sheet:i+1,...x})))}process.stdout.write(`${JSON.stringify({sheets:book.worksheets.length,projectEntries:projects,skillEntries:skills,errors:issues.length,issues},null,2)}\n`);if(issues.length)process.exitCode=1}
