import {isIP} from "node:net";

/** Vercel overwrites X-Forwarded-For at ingress. Local development uses an explicit opt-in override. */
export function trustedClientIp(request:Request,environment:Record<string,string|undefined>=process.env){
 const developmentIp=environment.ATTENDANCE_DEV_CLIENT_IP?.trim()??"";
 if(environment.NODE_ENV==="development"&&isIP(developmentIp))return developmentIp;
 if(environment.TRUSTED_CLIENT_IP_HEADER==="x-dts-client-ip"){
  // Ubuntu publishes only Nginx; it overwrites this header before forwarding to the private app.
  const value=request.headers.get("x-dts-client-ip")?.trim()??"";
  return value&&!value.includes(",")&&isIP(value)?value:null;
 }
 if(environment.VERCEL!=="1"||!(["production","preview"] as string[]).includes(environment.VERCEL_ENV??""))return null;
 const value=request.headers.get("x-forwarded-for")?.trim()??"";
 return value&&!value.includes(",")&&isIP(value)?value:null;
}
