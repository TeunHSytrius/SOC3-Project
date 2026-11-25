import {getAuthErrorMessage} from '../features/auth/authErrors';
export class ApiError extends Error { constructor(message:string,public status:number){super(message);} }
export async function api<T=any>(path:string,body?:Record<string,unknown>,context?:{workspaceId:string;scopeId?:string}):Promise<T>{
  let method=body===undefined?'GET':'POST';
  if(body!==undefined && /^(users|organizations)\/[^/]+$/.test(path)) method='PATCH';
  // Match the API routes specified in TO v1.3.
  path=path.replace(/^(alerts\/[^/]+)\/case$/,'$1/promote');
  if(/^cases\/[^/]+\/(status|owner|visibility)$/.test(path)){path=path.replace(/\/(status|owner|visibility)$/,'');method='PATCH';}
  if(/^cases\/[^/]+\/entry$/.test(path))path=path.replace(/\/entry$/,body?.kind==='Observable'?'/observables':'/events');
  const headers:Record<string,string>={};
  if(body!==undefined){headers['Content-Type']='application/json';const csrf=await fetch('/api/v1/auth/csrf',{credentials:'same-origin',cache:'no-store'});if(!csrf.ok)throw new ApiError('Beveiligingstoken ophalen mislukt.',csrf.status);headers['X-CSRF-TOKEN']=(await csrf.json()).token;}
  if(context?.workspaceId)headers['X-Workspace-Id']=context.workspaceId;
  if(context?.scopeId)headers['X-Scope-Id']=context.scopeId;
  const clean=body?Object.fromEntries(Object.entries(body).filter(([,value])=>value!=='')):undefined;
  const response=await fetch('/api/v1/'+path,{method,headers,credentials:'same-origin',body:clean===undefined?undefined:JSON.stringify(clean)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new ApiError(data?.message||data?.detail||data?.title||(response.status===401?getAuthErrorMessage('sessionExpired'):response.status===429?getAuthErrorMessage('temporarilyBlocked'):'Verzoek mislukt.'),response.status);
  return data as T;
}
