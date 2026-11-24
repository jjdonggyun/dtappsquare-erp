import {describe,expect,it} from "vitest";
import {trustedClientIp} from "../src/modules/attendance/domain/trusted-client-ip";
import {workManagementCommands} from "../src/modules/work-management/domain/contracts";

describe("local attendance and new work log regressions",()=>{
 it("uses an explicit attendance IP for localhost and LAN development",()=>{
  const env={NODE_ENV:"development",ATTENDANCE_DEV_CLIENT_IP:"203.0.113.10"};
  expect(trustedClientIp(new Request("http://localhost:3000"),env)).toBe("203.0.113.10");
  expect(trustedClientIp(new Request("http://192.168.1.141:3000"),env)).toBe("203.0.113.10");
  expect(trustedClientIp(new Request("http://localhost:3000"),{...env,NODE_ENV:"production"})).toBeNull();
  expect(trustedClientIp(new Request("http://192.168.1.141:3000"),{...env,ATTENDANCE_DEV_CLIENT_IP:"invalid"})).toBeNull();
 });
 it("accepts the zero version emitted by an unsaved work log form",()=>{
  const result=workManagementCommands.safeParse({action:"work_log.save",payload:{id:"",version:0,work_date:"2026-09-23",work_category:"INTERNAL_DEVELOPMENT",project_id:"",project_task_id:"",title:"New log",description:"",start_time:"",end_time:"",work_minutes:60,progress:"",status:"DONE",blocker:"",memo:""}});
  expect(result.success).toBe(true);
 });
});
