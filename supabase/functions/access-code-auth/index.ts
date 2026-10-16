import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
const url=Deno.env.get('SUPABASE_URL')!;
const adminKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,adminKey,options);
const allowed=new Set(['https://marwanywr3-lab.github.io','http://localhost:8766','http://127.0.0.1:8766']);
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const newCode=()=> 'MW-'+btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
function checked<T>(r:{data:T,error:any}):T{if(r.error)throw new Error('SERVER_ERROR');return r.data;}
async function issue(userId:string){
 const code=newCode();
 checked(await admin.from('access_code_credentials').upsert({user_id:userId,code_hash:await hash(code),created_at:new Date().toISOString()}));
 return code;
}
async function sessionFor(userId:string){
 const {user}=checked(await admin.auth.admin.getUserById(userId));
 if(!user?.email || user.banned_until&&Date.parse(user.banned_until)>Date.now())throw new Error('INVALID_CODE');
 const link=checked(await admin.auth.admin.generateLink({type:'magiclink',email:user.email}));
 const client=createClient(url,anonKey,options);
 const {session}=checked(await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'email'}));
 if(!session || session.user.id!==userId)throw new Error('SERVER_ERROR');
 return {access_token:session.access_token,refresh_token:session.refresh_token};
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 if(origin&&allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowed.has(origin))return reply({error:'ORIGIN_NOT_ALLOWED'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>4096)return reply({error:'INVALID_REQUEST'},400);
  const text=await req.text();if(text.length>4096)return reply({error:'INVALID_REQUEST'},400);
  let body;try{body=JSON.parse(text)}catch{return reply({error:'INVALID_REQUEST'},400)}
  const action=body?.action;
  if(!['register','login','issue'].includes(action))return reply({error:'INVALID_REQUEST'},400);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const ipHash=await hash(ip);
  const permitted=checked(await admin.rpc('consume_access_code_limit',{p_key:action+':'+ipHash,p_window:action==='login'?60:3600,p_max:action==='login'?30:10}));
  if(!permitted)return reply({error:'RATE_LIMITED'},429);
  if(action==='issue'){
   const jwt=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
   if(!jwt)return reply({error:'UNAUTHORIZED'},401);
   const auth=await admin.auth.getUser(jwt);
   if(auth.error||!auth.data.user)return reply({error:'UNAUTHORIZED'},401);
   return reply({code:await issue(auth.data.user.id)});
  }
  if(action==='register'){
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   const password=body.password;
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<12||password.length>128)return reply({error:'INVALID_SIGNUP'},400);
   // Requested email-free onboarding: create a confirmed account without sending mail.
   // Do not alter an account if this email already exists.
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
   if(created.error||!created.data.user)return reply({error:'SIGNUP_UNAVAILABLE'},400);
   const id=created.data.user.id;
   try{
    const code=await issue(id);
    return reply({code,session:await sessionFor(id)});
   }catch(e){
    // Only remove the new, unused account created by this request if onboarding failed.
    await admin.auth.admin.deleteUser(id);
    throw e;
   }
  }
  const code=typeof body.code==='string'?body.code.trim():'';
  if(!/^MW-[A-Za-z0-9_-]{43}$/.test(code))return reply({error:'INVALID_CODE'},401);
  const record=checked(await admin.from('access_code_credentials').select('user_id').eq('code_hash',await hash(code)).maybeSingle());
  if(!record)return reply({error:'INVALID_CODE'},401);
  return reply({session:await sessionFor(record.user_id)});
 }catch(e){
  return reply({error:e instanceof Error&&e.message==='INVALID_CODE'?'INVALID_CODE':'SERVER_ERROR'},e instanceof Error&&e.message==='INVALID_CODE'?401:503);
 }
});
