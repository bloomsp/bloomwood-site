import assert from 'node:assert/strict';
export async function verifyServices(f){
 const send=(p,v)=>f.request(p,new URLSearchParams(v).toString());
 const service={id:crypto.randomUUID(),version:'',name:'Fictional consulting',hourly_rate:'125.50'};
 assert.equal((await send('/sandbox/services/new',{...service,hourly_rate:'1.001'})).status,400);
 assert.equal((await send('/sandbox/services/new',service)).status,303);
 assert.equal((await send('/sandbox/services/new',service)).status,409);
 const pack={id:crypto.randomUUID(),version:'',name:'Fictional one hour',client_id:'11111111-1111-4111-8111-111111111111',service_type_id:service.id,purchased_minutes:'60'};
 assert.equal((await send('/sandbox/packs/new',pack)).status,303);
 const j={id:crypto.randomUUID(),version:'',client_id:pack.client_id,title:'Fictional allocation job',details:'',status:'open'};
 assert.equal((await send('/sandbox/jobs/new',j)).status,303);
 const tasks=[];
 for(let i=0;i<2;i++){
 const t={id:crypto.randomUUID(),version:'',title:'Fictional allocation task '+i,details:'',status:'open',billable_minutes:'45',non_billable_minutes:'15'};tasks.push(t);
 assert.equal((await send(`/sandbox/jobs/${j.id}/tasks/new`,t)).status,303);
 const v={id:t.id,version:'1',service_type_id:service.id,service_pack_id:pack.id};
 assert.equal((await send('/sandbox/allocations/'+t.id,{...v,service_type_id:''})).status,400);
 assert.equal((await send('/sandbox/allocations/'+t.id,v)).status,303);
 assert.equal((await send('/sandbox/allocations/'+t.id,v)).status,409);
 }
 const path='/sandbox/packs/'+pack.id+'/edit';
 assert.match(await (await f.request(path)).text(),/60 used minutes · 0 remaining minutes · 30 overflow minutes/);
 assert.equal((await send('/sandbox/tasks/'+tasks[0].id+'/edit',{...tasks[0],version:'2',status:'cancelled'})).status,303);
 assert.match(await (await f.request(path)).text(),/45 used minutes · 15 remaining minutes · 0 overflow minutes/);
 assert.equal((await send(path,{...pack,version:'1',purchased_minutes:'30'})).status,303);
 assert.equal((await send(path,{...pack,version:'1',purchased_minutes:'60'})).status,409);
 assert.match(await (await f.request(path)).text(),/30 used minutes · 0 remaining minutes · 15 overflow minutes/);
 assert.equal((await send('/sandbox/allocations/'+tasks[1].id,{id:tasks[1].id,version:'2',service_type_id:service.id,service_pack_id:''})).status,303);
 assert.match(await (await f.request(path)).text(),/0 used minutes · 30 remaining minutes · 0 overflow minutes/);
 return {service,pack,tasks};
}
