import {describe,expect,it} from "vitest";
import {capacityDuring,plannedProgress,actualProgress} from "@/modules/project-resource/domain/metrics";
const row=(start:string,end:string,rate:number,status="PLANNED")=>({id:"x",project_id:"x",user_id:"x",planned_start_date:start,planned_end_date:end,allocation_rate:rate,status});
describe("project planning metrics",()=>{
  it("counts overlapping dates inclusively and excludes paused allocations",()=>{
    const result=capacityDuring([row("2026-10-01","2026-10-31",70),row("2026-10-10","2026-10-20",50),row("2026-10-01","2026-10-31",80,"ON_HOLD")],"2026-10-01","2026-10-31");
    expect(result.peak).toBe(120);expect(result.overStart).toBe("2026-10-10");expect(result.overEnd).toBe("2026-10-20");
    expect(result.minimumAvailability).toBe(0);
  });
  it("uses leaf WBS items unless the PM set progress",()=>{
    const tasks=[{id:"a",parent_id:null,progress:0},{id:"b",parent_id:"a",progress:20},{id:"c",parent_id:"a",progress:80}];
    expect(actualProgress(null,tasks)).toBe(50);expect(actualProgress(45,tasks)).toBe(45);
    expect(plannedProgress("2026-10-01","2026-10-10","2026-10-05")).toBe(50);
  });
});
