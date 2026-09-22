import {isIP} from "node:net";

/** Vercel overwrites X-Forwarded-For at ingress. Other runtimes are unknown. */
export function trustedClientIp(request:Request,environment:Record<string,string|undefined>=process.env){
 if(environment.VERCEL!=="1"||!(["production","preview"] as string[]).includes(environment.VERCEL_ENV??""))return null;
 const value=request.headers.get("x-forwarded-for")?.trim()??"";
 return value&&!value.includes(",")&&isIP(value)?value:null;
}
