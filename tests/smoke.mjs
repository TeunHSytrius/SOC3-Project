import assert from 'node:assert/strict';
const base=process.env.SOC_URL||'http://localhost:8081';
class Client {
  cookies=new Map();
  async request(path,{method='GET',body,headers={},csrf=true}={}) {
    if(csrf && ['POST','PATCH'].includes(method) && !path.startsWith('ingest/')) {const t=await this.request('auth/csrf');headers={...headers,'X-CSRF-TOKEN':t.data.token};}
    // Use the last fetched version in explicit concurrency tests; otherwise fetch the current version.
    const match=path.match(/^(alerts|cases)\/([^/]+)/);
    if(csrf&&['POST','PATCH'].includes(method)&&match&&body&&!body.rowVersion){
      const current=await this.request(match[1]+'/'+match[2]);
      if(current.status===200)body={...body,rowVersion:current.data.rowVersion};
    }
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
// Group accounts are seeded once; their role/profile can be changed through user management.
const teamUsers=await admin.ok('users');
for(const email of ['teun@soc.demo','dominique@soc.demo','sergio@soc.demo','hamza@soc.demo','ruben@soc.demo','thijs@soc.demo'])assert(teamUsers.some(u=>u.email===email),`Demoaccount ontbreekt: ${email}`);
assert(!teamUsers.some(u=>u.email==='riza@soc.demo'&&u.isActive),'Voormalig groepsaccount mag niet actief zijn');
const north=orgs.find(o=>o.name==='Northstar Finance');const delta=orgs.find(o=>o.name==='Delta Logistics');assert(north&&delta);
const analyst=new Client();await analyst.login('analist');assert((await analyst.ok('alerts')).length>=8);
assert.equal((await analyst.request('auth/me',{headers:{'X-SOC-User':'00000000-0000-0000-0000-000000000000'}})).status,401,'Wrong tab identity must not use the shared cookie');
const customer=new Client();await customer.login('klant');assert.equal((await customer.request('alerts')).status,403);assert.equal((await customer.request('users')).status,403);assert.equal((await customer.request('organizations/'+delta.id)).status,403);

// Account management: a separate test account preserves the seeded demo accounts.
const unique=Date.now();
const created=await admin.post('users',{name:'Accounttest',email:`accounttest-${unique}@soc.demo`,password:'TestAccount2026!',role:'Klant',organizationIds:[north.id]});
const update={name:'Accounttest gewijzigd',email:`accounttest-edit-${unique}@soc.demo`,role:'Accountmanager',organizationIds:[delta.id],isActive:true};
assert.equal((await customer.request(`users/${created.id}`,{method:'PATCH',body:update})).status,403);
const edited=await admin.ok(`users/${created.id}`,{method:'PATCH',body:{...update,password:'NewAccount2026!'}});
assert.equal(edited.name,update.name);assert.equal(edited.email,update.email);assert.equal(edited.role,'Accountmanager');assert.deepEqual(edited.organizationIds,[delta.id]);assert.equal(edited.isActive,true);
const editedClient=new Client();
assert.equal((await editedClient.request('auth/login',{method:'POST',body:{username:update.email,password:'TestAccount2026!'}})).status,401);
await editedClient.post('auth/login',{username:update.email,password:'NewAccount2026!'});
assert.equal((await editedClient.ok('organizations'))[0].id,delta.id);
await admin.ok(`users/${created.id}`,{method:'PATCH',body:{...update,isActive:false}});
assert.equal((await editedClient.request('auth/me')).status,401);
const inactiveClient=new Client();
assert.equal((await inactiveClient.request('auth/login',{method:'POST',body:{username:update.email,password:'NewAccount2026!'}})).status,401);
await admin.ok(`users/${created.id}`,{method:'PATCH',body:update});
await inactiveClient.post('auth/login',{username:update.email,password:'NewAccount2026!'});
await admin.ok(`users/${created.id}`,{method:'PATCH',body:{...update,isActive:false}});
assert((await admin.ok('audit')).some(a=>a.action==='Gebruikersaccount gewijzigd'&&a.target===created.id));

// Organization rename uses the same stable tenant ID and does not reprovision its schema.
const temporaryOrg=await admin.post('organizations',{name:'Tijdelijke klant '+unique});
const renamed=await admin.ok(`organizations/${temporaryOrg.id}`,{method:'PATCH',body:{name:'Hernoemde klant '+unique,responseMinutes:90}});
assert.equal(renamed.id,temporaryOrg.id);assert.equal(renamed.name,'Hernoemde klant '+unique);assert.equal(renamed.responseMinutes,90);
await admin.post(`organizations/${temporaryOrg.id}/deactivate`);
assert.equal((await admin.ok(`organizations/${temporaryOrg.id}`)).isActive,false);
const key=await admin.post('keys',{name:'Smoke test '+Date.now(),organizationId:north.id});assert(key.secret);assert(!(await admin.ok('keys')).some(k=>k.secret||k.hash));
const tool=new Client();
const payload={externalEventId:'smoke-'+Date.now(),title:'MVP smoke test',occurredAt:new Date().toISOString(),severity:'High',payload:{description:'Fictieve melding voor de lokale test.',category:'Authenticatie',sourceIp:'192.0.2.10',destinationIp:'198.51.100.10',hostname:'DEMO-DC01',username:'demo.user',detectionRule:'AUTH-001',simulated:true}};
const ingestOpts={method:'POST',headers:{'X-API-Key':key.secret},body:payload};
assert.equal((await tool.request('ingest/alerts',{...ingestOpts,body:{...payload,organizationId:delta.id}})).status,400);
const first=await tool.request('ingest/alerts',ingestOpts);assert.equal(first.status,201);const alert=first.data;
assert.equal(alert.organizationId,north.id);assert.equal(alert.rawPayload,JSON.stringify(payload));assert.equal(alert.security.category,'Authenticatie');assert.equal(alert.security.sourceIp,'192.0.2.10');assert.equal(alert.description,payload.payload.description);assert.equal(JSON.parse(alert.normalizedPayload).class_uid,2004);assert.equal(JSON.parse(alert.normalizedPayload).severity_id,4);
const replay=await tool.request('ingest/alerts',ingestOpts);assert.equal(replay.status,200);assert.equal(replay.data.id,alert.id);
assert.equal((await tool.request('ingest/alerts',{...ingestOpts,body:{...payload,title:'Gewijzigd'}})).status,409);
assert.equal((await analyst.request(`alerts/${alert.id}/claim`,{method:'POST',body:{},csrf:false})).status,400,'CSRF vereist');
const claimed=await analyst.post(`alerts/${alert.id}/claim`);assert(claimed.firstHandledAt);assert.equal(claimed.status,'UnderReview');assert.notEqual(claimed.rowVersion,alert.rowVersion,'Claim must update rowversion');assert(claimed.history.some(h=>h.text==='Alert opgepakt'),'Claim history must be inserted');
const persistedClaim=await analyst.ok(`alerts/${alert.id}`);assert.equal(persistedClaim.rowVersion,claimed.rowVersion);assert(persistedClaim.history.some(h=>h.text==='Alert opgepakt'),'Claim history must persist');
assert.equal((await analyst.request(`alerts/${alert.id}/triage`,{method:'POST',body:{rowVersion:alert.rowVersion,outcome:'Bevestigd incident',reason:'Verouderde versie'}})).status,409);
assert.equal((await analyst.request(`alerts/${alert.id}/claim`,{method:'POST',body:{}})).status,409);
await analyst.post(`alerts/${alert.id}/triage`,{outcome:'Bevestigd incident',reason:'Demotest'});
const promoted=await analyst.post(`alerts/${alert.id}/promote`,{title:'Smoke test case'});assert(promoted.caseId);
const id=promoted.caseId;
const senior=new Client();await senior.login('senior');
const analystUser=await analyst.ok('auth/me');
assert.equal((await analyst.request(`cases/${id}`,{method:'PATCH',body:{status:'UnderInvestigation'}})).status,409,'Coordinator assignment required');
const assigned=await senior.ok(`cases/${id}`,{method:'PATCH',body:{userId:analystUser.id,priority:'High',reason:'Demo prioritering',nextAction:'Onderzoek uitvoeren'}});assert.equal(assigned.status,'UnderInvestigation');
await analyst.post(`cases/${id}/events`,{kind:'Notitie',text:'Interne testnotitie',visible:false});
await analyst.post(`cases/${id}/observables`,{value:'192.0.2.25',type:'IP',assessment:'Verdacht'});
const persistedCase=await analyst.ok(`cases/${id}`);assert(persistedCase.entries.some(e=>e.text==='Interne testnotitie'));assert(persistedCase.entries.some(e=>e.kind==='Observable'&&e.text.includes('192.0.2.25')));
assert.equal((await customer.request(`portal/cases/${id}`)).status,404);
await analyst.ok(`cases/${id}`,{method:'PATCH',body:{visible:true}});
await analyst.post(`cases/${id}/events`,{kind:'Actie',text:'Klantzichtbare actie',visible:true});
const portal=await customer.ok(`portal/cases/${id}`);assert(portal.entries.some(e=>e.text==='Klantzichtbare actie'));assert(!portal.entries.some(e=>e.text==='Interne testnotitie'||e.kind==='Observable'));
assert.equal((await analyst.request(`alerts/${alert.id}`,{headers:{'X-Workspace-Id':delta.id}})).status,404);
assert.equal((await analyst.request(`cases/${id}`,{method:'PATCH',body:{status:'Closed'}})).status,409);
await analyst.ok(`cases/${id}`,{method:'PATCH',body:{status:'Resolved'}});
assert.equal((await analyst.request(`cases/${id}`,{method:'PATCH',body:{status:'Closed'}})).status,400);
const closed=await analyst.ok(`cases/${id}`,{method:'PATCH',body:{status:'Closed',summary:'Onderzoek en acties afgerond.',conclusion:'Demotest afgerond.'}});assert.equal(closed.status,'Closed');assert.equal((await analyst.ok(`alerts/${alert.id}`)).status,'Resolved');
await admin.post(`keys/${key.id}/revoke`);assert.equal((await tool.request('ingest/alerts',{method:'POST',headers:{'X-API-Key':key.secret},body:payload})).status,401);
assert((await admin.ok('audit')).some(a=>a.action==='Alert promote'&&a.target===alert.number));
console.log('PASS: login, rollen, accountbewerking, ingest, securitymapping, CSRF, triage, toewijzing, workflow, afscherming, afsluiten, audit en intrekking sleutel.');
