import {getAuthErrorMessage} from '../features/auth/authErrors';
// Only a user ID is stored in tab memory. The authentication secret stays in the HttpOnly cookie.
export const sessionKey='soc3.activeUser';
export class ApiError extends Error {
  constructor(message:string,public status:number,public traceId?:string){
    super(message+(status?' (HTTP '+status+')':'')+(traceId?' · Foutreferentie: '+traceId:''));
  }
}
async function request(url:string,options:RequestInit):Promise<Response>{
  try{return await fetch(url,options);}
  catch{throw new ApiError('Geen verbinding met de SOC-server. Controleer Docker of je netwerk.',0);}
}
async function responseError(response:Response,data:any):Promise<never>{
  const fields=data?.errors&&typeof data.errors==='object'?Object.values(data.errors).flat().join(' '):'';
  const message=data?.message||fields||data?.detail||data?.title||
    (response.status===401?getAuthErrorMessage('sessionExpired'):response.status===403?'Je hebt geen toegang tot dit onderdeel.':response.status===429?getAuthErrorMessage('temporarilyBlocked'):'Verzoek mislukt.');
  throw new ApiError(message,response.status,response.headers.get('X-Trace-Id')||data?.traceId||undefined);
}
export async function api<T=any>(path:string,body?:Record<string,unknown>,context?:{workspaceId:string;scopeId?:string}):Promise<T>{
  let method=body===undefined?'GET':'POST';
  if(body!==undefined && /^(users|organizations)\/[^/]+$/.test(path)) method='PATCH';
  // Match the API routes specified in TO v1.3.
  path=path.replace(/^(alerts\/[^/]+)\/case$/,'$1/promote');
  if(/^cases\/[^/]+\/(status|owner|visibility)$/.test(path)){path=path.replace(/\/(status|owner|visibility)$/,'');method='PATCH';}
  if(/^cases\/[^/]+\/entry$/.test(path))path=path.replace(/\/entry$/,body?.kind==='Observable'?'/observables':'/events');
  const headers:Record<string,string>={};
  const activeUser=sessionStorage.getItem(sessionKey);
  if(activeUser&&path!=='auth/login'&&path!=='auth/2fa')headers['X-SOC-User']=activeUser;
  if(body!==undefined){headers['Content-Type']='application/json';const csrf=await request('/api/v1/auth/csrf',{credentials:'same-origin',cache:'no-store'});if(!csrf.ok)await responseError(csrf,await csrf.json().catch(()=>null));headers['X-CSRF-TOKEN']=(await csrf.json()).token;}
  if(context?.workspaceId)headers['X-Workspace-Id']=context.workspaceId;
  if(context?.scopeId)headers['X-Scope-Id']=context.scopeId;
  const clean=body?Object.fromEntries(Object.entries(body).filter(([,value])=>value!=='')):undefined;
  const response=await request('/api/v1/'+path,{method,headers,credentials:'same-origin',body:clean===undefined?undefined:JSON.stringify(clean)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)await responseError(response,data);
  if(data===null)throw new ApiError('De server gaf geen geldig JSON-antwoord.',response.status,response.headers.get('X-Trace-Id')||undefined);
  return data as T;
}
