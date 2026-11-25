import assert from 'node:assert/strict';
const base=process.env.SOC_URL||'http://localhost:8081';
class Client {
  cookies=new Map();
  async request(path,{method='GET',body,headers={},csrf=true}={}) {
    if(csrf && ['POST','PATCH'].includes(method) && !path.startsWith('ingest/')) {const t=await this.request('auth/csrf');headers={...headers,'X-CSRF-TOKEN':t.data.token};}
    const response=await fetch(`${base}/api/v1/${path}`,{method,headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'}),Cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')},body:body===undefined?undefined:JSON.stringify(body)});
    for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';');const eq=pair.indexOf('=');const key=pair.slice(0,eq);if(/max-age=0/i.test(cookie)||!pair.slice(eq+1))this.cookies.delete(key);else this.cookies.set(key,pair.slice(eq+1));}
    const data=await response.json().catch(()=>null);return {status:response.status,data};
  }
  async ok(path,opts={}){const {status,data}=await this.request(path,opts);assert(status>=200&&status<300,`${path}: ${status} ${JSON.stringify(data)}`);assert(data!==null,`${path}: JSON verwacht`);return data;}
  post(path,body={}){return this.ok(path,{method:'POST',body});}
  login(role){return this.post('auth/login',{username:`${role}@soc.demo`,password:'Demo2026!'});}
}
const guest=new Client();await guest.ok('health');assert.equal((await guest.request('alerts')).status,401);
const admin=new Client();await admin.login('beheerder');const orgs=await admin.ok('organizations');assert(orgs.length>=3);assert.equal((await admin.request('alerts')).status,403);
const north=orgs.find(o=>o.name==='Northstar Finance');const delta=orgs.find(o=>o.name==='Delta Logistics');assert(north&&delta);
const analyst=new Client();await analyst.login('analist');assert((await analyst.ok('alerts')).length>=8);
const customer=new Client();await customer.login('klant');assert.equal((await customer.request('alerts')).status,403);assert.equal((await customer.request('users')).status,403);assert.equal((await customer.request('organizations/'+delta.id)).status,403);
const key=await admin.post('keys',{name:'Smoke test '+Date.now(),organizationId:north.id});assert(key.secret);assert(!(await admin.ok('keys')).some(k=>k.secret||k.hash));
const tool=new Client();const alert=await tool.ok('ingest/alerts',{method:'POST',headers:{'X-API-Key':key.secret},body:{title:'MVP smoke test',description:'Fictieve melding voor de lokale test.',priority:'High',organizationId:delta.id}});assert.equal(alert.organizationId,north.id,'Bron bepaalt tenant, niet requestbody');
assert.equal((await analyst.request(`alerts/${alert.id}/claim`,{method:'POST',body:{},csrf:false})).status,400,'CSRF vereist');
const claimed=await analyst.post(`alerts/${alert.id}/claim`);assert(claimed.firstHandledAt);assert.equal(claimed.status,'UnderReview');
await analyst.post(`alerts/${alert.id}/triage`,{outcome:'True positive',reason:'Demotest'});
const promoted=await analyst.post(`alerts/${alert.id}/promote`,{title:'Smoke test case'});assert(promoted.caseId);
const id=promoted.caseId;
await analyst.post(`cases/${id}/events`,{kind:'Notitie',text:'Interne testnotitie',visible:false});
await analyst.post(`cases/${id}/observables`,{value:'192.0.2.25',type:'IP'});
assert.equal((await customer.request(`portal/cases/${id}`)).status,404);
await analyst.ok(`cases/${id}`,{method:'PATCH',body:{visible:true}});
await analyst.post(`cases/${id}/events`,{kind:'Actie',text:'Klantzichtbare actie',visible:true});
const portal=await customer.ok(`portal/cases/${id}`);assert(portal.entries.some(e=>e.text==='Klantzichtbare actie'));assert(!portal.entries.some(e=>e.text==='Interne testnotitie'||e.kind==='Observable'));
assert.equal((await analyst.request(`alerts/${alert.id}`,{headers:{'X-Workspace-Id':delta.id}})).status,404);
assert.equal((await analyst.request(`cases/${id}`,{method:'PATCH',body:{status:'Closed'}})).status,400);
const closed=await analyst.ok(`cases/${id}`,{method:'PATCH',body:{status:'Closed',conclusion:'Demotest afgerond.'}});assert.equal(closed.status,'Closed');assert.equal((await analyst.ok(`alerts/${alert.id}`)).status,'Resolved');
await admin.post(`keys/${key.id}/revoke`);assert.equal((await tool.request('ingest/alerts',{method:'POST',headers:{'X-API-Key':key.secret},body:{title:'Ingetrokken sleutel',description:'Niet opslaan',priority:'Low'}})).status,401);
assert((await admin.ok('audit')).some(a=>a.action==='Alert promote'&&a.target===alert.number));
console.log('PASS: login, rollen, ingest, CSRF, triage, case, afscherming, afsluiten, audit en intrekking sleutel.');
