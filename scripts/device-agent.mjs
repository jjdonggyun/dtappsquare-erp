import {createServer} from "node:http";
import {randomBytes} from "node:crypto";

const appUrl=process.env.DEVICE_AGENT_APP_URL;
const origin=process.env.DEVICE_AGENT_ALLOWED_ORIGIN;
const deviceId=process.env.DEVICE_AGENT_ID;
const token=process.env.DEVICE_AGENT_TOKEN;
const port=Number(process.env.DEVICE_AGENT_PORT??45873);
if(!appUrl||!origin||!deviceId||!token||token.length<32||
  (!appUrl.startsWith("https://")&&!appUrl.startsWith("http://localhost:")&&!appUrl.startsWith("http://127.0.0.1:")))
 throw new Error("Device Agent URL, origin, device ID and token must be configured securely.");

const server=createServer(async(request,response)=>{
 const incomingOrigin=request.headers.origin;
 if(incomingOrigin!==origin){response.writeHead(403);response.end();return}
 response.setHeader("Access-Control-Allow-Origin",origin);
 response.setHeader("Vary","Origin");
 response.setHeader("Cache-Control","no-store");
 if(request.method==="OPTIONS"){
  response.writeHead(204,{"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type"});response.end();return;
 }
 if(request.method!=="POST"||request.url!=="/proof"||!request.headers["content-type"]?.startsWith("application/json")){
  response.writeHead(404);response.end();return;
 }
 try{
  let raw="";for await(const chunk of request){raw+=chunk;if(raw.length>1024)throw new Error("Payload too large")}
  const {verification_id:verificationId}=JSON.parse(raw);
  if(typeof verificationId!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(verificationId))throw new Error("Invalid proof request");
  const result=await fetch(new URL("/api/device-agent/attendance-proof",appUrl),{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({verification_id:verificationId,device_id:deviceId,device_token:token,
     timestamp:new Date().toISOString(),nonce:randomBytes(24).toString("hex")})
  });
  response.writeHead(result.ok?200:403,{"Content-Type":"application/json"});
  response.end(JSON.stringify({accepted:result.ok}));
 }catch{response.writeHead(400,{"Content-Type":"application/json"});response.end('{"accepted":false}')}
});
server.listen(port,"127.0.0.1",()=>{process.stdout.write(`Device Agent listening on 127.0.0.1:${port}\n`)});
