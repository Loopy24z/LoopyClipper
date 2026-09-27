"use client";
import {useEffect,useState} from 'react';
import {api} from '@/lib/types';
export default function Billing({admin=false}:{admin?:boolean}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>api(admin?'admin':'billing').then(setData).catch(e=>setError(e.message));
 useEffect(()=>{load()},[admin]);
 async function act(action:string,b:any){setBusy(true);setError('');try{await api(admin?'admin/'+action:'billing',{method:'POST',body:JSON.stringify(b)});await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 if(!data)return <p role="status">{error||'Loading…'}</p>;
 return <section className="billing-panel"><h2>{admin?'Administration':'Credits & subscription'}</h2>{error&&<p role="alert" className="notice error">{error}</p>}{!admin?<>
 <div className="notice"><strong>{data.account.unlimited?"Unlimited admin credits":`${data.account.free} daily + ${data.account.paid} subscription credits`}</strong><p>1 credit per started source minute. Editing and exports are included.</p><p>Daily allowance: {data.account.daily}. Resets at 00:00 WIB · {new Date(data.account.nextReset).toLocaleString()} local time.</p>{data.account.paid_until>0&&<p>Subscription credits expire {new Date(data.account.paid_until).toLocaleDateString()}.</p>}</div>
 <p>{data.subscriptionsEnabled?'Subscriptions are activated manually by the administrator. No automatic payment or renewal.':'Private beta: subscription purchases are disabled. Daily free credits remain available.'}</p>
 {data.plans.map((p:any)=><div className="notice" key={p.id}><h3>{p.name}</h3><p>{p.credits} credits · {p.days} days · {p.price}</p><button className="primary" disabled={busy||data.subscriptions.some((s:any)=>s.status==='requested')} onClick={()=>act('',{plan:p.id})}>Request activation</button></div>)}
 <h3>Requests</h3>{data.subscriptions.map((s:any)=><p key={s.id}>{s.plan} · {s.status}{s.expires?` · until ${new Date(s.expires).toLocaleDateString()}`:''}</p>)}
 <h3>Credit history</h3>{data.ledger.map((l:any)=><p key={l.project}>{l.day} · {l.free+l.paid} credits · {l.refunded?'Refunded':'Source processing'}</p>)}
 </>:<>
 <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);act('daily',{daily:Number(f.get('daily'))})}}><label className="field">Daily free credits<input name="daily" type="number" min="0" max="100000" defaultValue={data.daily} required/></label><button disabled={busy} className="primary">Save allowance</button></form>
 <h3>Subscription requests</h3>{data.subscriptions.map((s:any)=><form key={s.id} onSubmit={e=>{e.preventDefault();act('activate',{id:s.id,reference:new FormData(e.currentTarget).get('reference')})}}><p>{s.owner} · {s.plan} · {s.status}</p>{s.status==='requested'&&<><label className="field">Payment / approval reference<input name="reference" required maxLength={300}/></label><button disabled={busy}>Activate subscription</button></>}</form>)}
 <h3>Accounts</h3>{data.accounts.map((a:any)=><div className="notice" key={a.id}><p>{a.email} · {a.paid} subscription credits</p><small>{a.id}</small><button disabled={busy} onClick={()=>act('disable',{id:a.id,disabled:!a.disabled})}>{a.disabled?'Enable':'Disable'}</button><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);act('grant',{id:a.id,credits:Number(f.get('credits')),reason:f.get('reason')})}}><label className="field">Add credits (valid 30 days)<input name="credits" type="number" min="1" max="100000" required/></label><label className="field">Reason<input name="reason" required maxLength={300}/></label><button disabled={busy}>Add credits</button></form></div>)}
 <h3>Create or update plan</h3><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);act('plan',{id:f.get('id'),name:f.get('name'),credits:Number(f.get('credits')),days:Number(f.get('days')),price:f.get('price')})}}>{['id','name','credits','days','price'].map(n=><label className="field" key={n}>{n}<input name={n} required type={['credits','days'].includes(n)?'number':'text'} min="1"/></label>)}<button disabled={busy}>Save plan</button></form>
 <h3>Projects</h3>{data.projects.map((p:any)=><div className="notice" key={p.id}><p>{p.name} · {p.status}</p><small>{p.owner}</small><button disabled={busy} onClick={()=>{if(window.confirm('Permanently delete this project and all its media?'))act('delete-project',{id:p.id})}}>Delete project</button></div>)}
 <h3>Admin history</h3>{data.audit.map((a:any)=><p key={a.id}>{new Date(a.created).toLocaleString()} · {a.action} · {a.target}</p>)}
 </>}</section>;
}
