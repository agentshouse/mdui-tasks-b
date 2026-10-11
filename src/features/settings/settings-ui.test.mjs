import { assertQueryPointers, strictQueryObservation } from '../../../tests/query-contract.mjs'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { createHouseBridgeTestHost } from '@agentshouse/app-bridge/test-host'
import { createServer } from 'vite'
const window = new Window({ url: 'http://localhost/' })
for (const name of ['window','document','navigator','HTMLElement','Element','Node','NodeFilter','Text','Event','CustomEvent','FocusEvent','MouseEvent','KeyboardEvent','InputEvent','MutationObserver','ResizeObserver','FileList','File','DocumentFragment','HTMLInputElement','HTMLButtonElement','HTMLFormElement','HTMLSelectElement','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) {
  const value = name === 'window' ? window : window[name]
  if (value !== undefined) Object.defineProperty(globalThis, name, { configurable: true, value: typeof value === 'function' && /^[a-z]/.test(name) ? value.bind(window) : value })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const signal = initial => { let value=initial;const listeners=new Set();return {current:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},close(){},emit(next){value=next;listeners.forEach(fn=>fn(next))}} }
const room='settings-room'
const defaults={bio:'I own a computer.',urls:[{value:'https://shadcn.com'},{value:'http://twitter.com/shadcn'}]}
const records=[
 {room,path:'preferences/profile.md',type:'profile',fields:{...defaults,username:'shadcn',email:'m@example.com'}},
 {room,path:'preferences/account.md',type:'account',fields:{name:''}},
 {room,path:'preferences/notifications.md',type:'notification-preferences',fields:{communication_emails:false,marketing_emails:false,social_emails:true,security_emails:true}},
]
const drafts=new Map();let revision=0;const saves=[];let presentation={other:{kept:true},settings:{untouched:'yes'}};const presentationWrites=[]
const signals={rooms:signal([{locator:room}]),'sync-status':signal({lastCompleted:'completed',attentionRequired:[]}),'room-drafts':signal([]),'service-mode':signal('open'),'connection-refusal':signal(null),query:signal({documents:records}),tasks:signal({documents:[]}),presentation:signal(presentation)}
const emitDrafts=()=>signals['room-drafts'].emit([...drafts.values()].map(d=>structuredClone(d)))
let writeBarrier=null, readBarrier=null, failField=null
const runtime={
 observe:async(kind,query)=>{if(kind==='query'){assertQueryPointers(query);return strictQueryObservation(query,query.types?signals.tasks:signals.query)}return signals[kind]},
 presentation:{read:async()=>structuredClone(presentation),write:async value=>{presentation=structuredClone(value);presentationWrites.push(value);signals.presentation.emit(presentation)}},
 roomDraft:{read:async(_room,path)=>{if(readBarrier)await readBarrier;return structuredClone(drafts.get(path)??null)},write:async(room,path,seen,parts)=>{
  if(failField&&parts.fields?.[failField]){failField=null;throw new Error('Injected field write failure')}
  const previous=drafts.get(path);if((previous?.revision??null)!==seen)return{outcome:'stale',roomDraft:structuredClone(previous)}
  const next={room,path,revision:`draft-${++revision}`,parts:structuredClone(parts),returned:null,changedUnderneath:{}}
  for(const key of Object.keys(next.parts.fields??{}))if(previous?.parts.fields?.[key])next.parts.fields[key].base=previous.parts.fields[key].base
  drafts.set(path,next);emitDrafts();if(writeBarrier)await writeBarrier;return{outcome:'written',roomDraft:structuredClone(next)}
 }},
 save:async(room,items)=>{saves.push({room,items});for(const item of items)drafts.delete(item.path);emitDrafts();return{outcome:'saved',identifier:'local-queue'}}
}
const host=createHouseBridgeTestHost({address:'/app/a_e.n'});host.attachRuntime(runtime)
globalThis.houseBridge=window.houseBridge=host.port;globalThis.houseRuntime=window.houseRuntime=host.runtime
const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}})
let root
const flush=async()=>{await act(async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve))})}
try {
 const {WorkspaceProvider}=await server.ssrLoadModule('/src/features/workspace/context.tsx')
 const {Settings}=await server.ssrLoadModule('/src/features/settings/index.tsx')
 const {SidebarProvider}=await server.ssrLoadModule('/src/components/ui/sidebar.tsx')
 const {ThemeProvider}=await server.ssrLoadModule('/src/context/theme-provider.tsx')
 const mount=async()=>{const node=document.createElement('div');document.body.append(node);root=createRoot(node);await act(async()=>root.render(h(ThemeProvider,null,h(WorkspaceProvider,null,h(SidebarProvider,null,h(Settings))))));await flush()}
 const input=async(selector,value)=>{await act(async()=>{const element=document.querySelector(selector);Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new window.Event('input',{bubbles:true}));element.dispatchEvent(new window.Event('change',{bubbles:true}))});await flush()}
 const click=async selector=>{await act(async()=>document.querySelector(selector).click());await flush()}
 const submit=async selector=>{await act(async()=>document.querySelector(selector).closest('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await flush()}
 await mount()
 assert.equal(document.querySelectorAll('[aria-label$=" settings"]').length,5,'All five sections are eagerly mounted')
 assert.equal(document.querySelector('#settings-username').value,'shadcn')
 await input('#settings-username','');assert.equal(drafts.get('preferences/profile.md').parts.fields.username.value,'');assert.equal(saves.length,0)
 assert.equal(document.querySelectorAll('[role="alert"]').length,0,'No validation during invalid typing')
 await submit('#settings-username');assert.equal(saves.length,0);assert.match(document.body.textContent,/Username must be at least 2 characters/)
 await input('#settings-username','unfinished profile');await act(async()=>root.unmount());await mount();assert.equal(document.querySelector('#settings-username').value,'unfinished profile')
 const current=drafts.get('preferences/profile.md');await act(async()=>{drafts.set(current.path,{...current,revision:`draft-${++revision}`,parts:{fields:{...current.parts.fields,username:{value:'Other tab profile',base:{value:'shadcn'}}}}});emitDrafts()});await flush();assert.equal(document.querySelector('#settings-username').value,'Other tab profile')
 await input('#settings-name','x');assert.equal(drafts.get('preferences/account.md').parts.fields.name.value,'x');assert.equal(saves.length,0)
 await click('#settings-dob');await input('input[aria-label="Date of birth, YYYY-MM-DD"]','not a date');assert.equal(drafts.get('preferences/account.md').parts.fields.dob.value,'not a date','Invalid date remains in the actual Room draft')
 await click('#notification-mentions');assert.equal(drafts.get('preferences/notifications.md').parts.fields.notificationType.value,'mentions');assert.equal(drafts.get('preferences/notifications.md').parts.fields.type,undefined)
 await click('#settings-marketing_emails');assert.equal(drafts.get('preferences/notifications.md').parts.fields.marketing_emails.value,true);assert.equal(saves.length,0)
 const count=drafts.size
 await act(async()=>{const select=document.querySelector('select[name="font"]');select.value='system';select.dispatchEvent(new window.Event('change',{bubbles:true}))});await flush()
 assert.equal(presentation.settings.appearance.font,'system');assert.equal(drafts.size,count,'Appearance never creates business Room drafts')
 assert.deepEqual(presentation.other,{kept:true});assert.equal(presentation.settings.untouched,'yes','Unrelated Presentation keys preserved')
 await click('#display-downloads');assert.deepEqual(presentation.settings.display.items,['recents','home','downloads']);assert.equal(drafts.size,count,'Display never creates business Room drafts')
 await act(async()=>root.unmount());await mount();assert.equal(document.querySelector('select[name="font"]').value,'system');assert.equal(document.querySelector('#display-downloads').getAttribute('aria-checked'),'true')
 await act(async()=>signals.rooms.emit([]));await flush();await submit('#settings-username');assert.equal(saves.length,0,'Reach loss blocks Save')
 await act(async()=>{signals.rooms.emit([{locator:room}]);signals['service-mode'].emit('write-halted')});await flush();await submit('#settings-username');assert.equal(saves.length,1,'Explicit Save queues locally during provider write halt')
 await act(async()=>signals.query.emit({documents:records.filter(record=>record.type!=='account')}));await flush();assert.equal(document.querySelector('#settings-name').closest('fieldset').disabled,true);const writesBefore=drafts.size;await submit('#settings-name');assert.equal(drafts.size,writesBefore,'Missing Settings records never synthesize creations');assert.match(document.body.textContent,/This Settings record is missing/)
 await act(async()=>root.unmount())
 const {useDocumentDraft,useWorkspace}=await server.ssrLoadModule('/src/features/workspace/context.tsx')
 let selectedPath='preferences/profile.md', editor
 const initialFields={conversation:'donor-conversation',sender:'You',timestamp:'2026-10-11T15:00:00.000Z'}
 function Probe(){const workspace=useWorkspace();editor=useDocumentDraft(workspace.records.find(row=>row.path===selectedPath),'chat-message',selectedPath,initialFields);return h('div',null,JSON.stringify(editor.values))}
 const node=document.createElement('div');document.body.append(node);root=createRoot(node)
 const renderProbe=async()=>{await act(async()=>root.render(h(WorkspaceProvider,null,h(Probe))));await flush()}
 await act(async()=>signals.query.emit({documents:records}));await renderProbe()
 let releaseWrite;writeBarrier=new Promise(resolve=>{releaseWrite=resolve})
 await act(async()=>editor.setField('username','queued old profile'));await flush()
 await act(async()=>editor.setField('bio','queued old bio'));await flush()
 selectedPath='preferences/account.md';await renderProbe();const accountName=editor.values.name
 releaseWrite();writeBarrier=null;await flush()
 assert.equal(editor.values.name,accountName,'Old scope acknowledgements cannot redraw the new editor')
 assert.equal(editor.values.bio,undefined,'Queued old profile values never leak into account editor')
 assert.deepEqual(drafts.get('preferences/profile.md').parts.fields.bio.base,{value:'I own a computer.'},'Queued old write retains its original record base')
 let releaseRead;readBarrier=new Promise(resolve=>{releaseRead=resolve})
 selectedPath='chats/message-new.md';await renderProbe();assert.equal(editor.ready,false,'New exact session stays unready until its read resolves');assert.equal(editor.values.name,undefined)
 releaseRead();readBarrier=null;await flush();assert.equal(editor.ready,true)
 await act(async()=>editor.setField('body','unfinished message'));await flush()
 assert.deepEqual(drafts.get(selectedPath).parts.creation.fields,{...initialFields,body:'unfinished message'},'First actual message draft includes captured initial fields')
 await act(async()=>editor.setField('body','later message'));await flush();assert.equal(drafts.get(selectedPath).parts.creation.fields.conversation,'donor-conversation')
 const savedMessage={room,path:selectedPath,type:'chat-message',fields:{...initialFields,body:'Saved by another tab'}}
 await act(async()=>{drafts.delete(selectedPath);emitDrafts();signals.query.emit({documents:[...records,savedMessage]})});await flush()
 await act(async()=>editor.setField('body','Edit after remote save'));await flush()
 assert.equal(drafts.get(selectedPath).parts.creation,undefined,'Saved creation transitions to actual document fields')
 assert.deepEqual(drafts.get(selectedPath).parts.fields.body.base,{value:'Saved by another tab'})
 failField='body';await act(async()=>editor.setField('body','Failed visible edit'));await flush()
 await act(async()=>editor.setField('sender','You'));await flush();const savedBefore=saves.length
 await act(async()=>{await assert.rejects(editor.save(),/Some edits could not be written/)})
 assert.equal(saves.length,savedBefore,'A failed visible field blocks Save even if another field writes later')
 await act(async()=>editor.setField('body','Retried visible edit'));await flush();await act(async()=>editor.save());await flush();assert.equal(saves.length,savedBefore+1)
 console.log('PASS: Settings actual draft integration; invalid DOB/profile/account input; all five eager sections; missing-record guard; durable remount/cross-tab edits; Presentation-only preferences; reach-loss and write-halt behavior; exact-session hydration; delayed scope-switch acknowledgements and original bases; chat-message initial fields; creation-to-saved transition; failed-field Save protection and retry.')
} finally {if(root)await act(async()=>root.unmount());await server.close();await window.happyDOM.abort()}
