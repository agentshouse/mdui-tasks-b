import { assertQueryPointers, strictQueryObservation } from './query-contract.mjs'
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
const room='tasks-room', path='tasks/task-existing.md'
const row={id:'TASK-1001',title:'Original',status:'todo',label:'feature',priority:'medium',room,path}
const drafts=new Map();let revision=0;const saves=[]
const signals={rooms:signal([{locator:room}]),'sync-status':signal({lastCompleted:'completed',attentionRequired:[]}),'room-drafts':signal([]),'service-mode':signal('open'),'connection-refusal':signal(null),query:signal({documents:[{room,path,fields:row}]})}
const emitDrafts=()=>signals['room-drafts'].emit([...drafts.values()].map(d=>structuredClone(d)))
let writeDelay=null
const runtime={
 observe:async (kind,query)=>{if(kind==='query'){assertQueryPointers(query);return strictQueryObservation(query,signals[kind])}return signals[kind]},
 roomDraft:{read:async(_room,path)=>structuredClone(drafts.get(path)??null),write:async(room,path,seen,parts)=>{
   const previous=drafts.get(path)
   if((previous?.revision??null)!==seen)return{outcome:'stale',roomDraft:structuredClone(previous)}
   const next={room,path,revision:`draft-${++revision}`,parts:structuredClone(parts),returned:null,changedUnderneath:{}}
   for(const group of ['fields','sections'])for(const key of Object.keys(next.parts[group]??{}))if(previous?.parts[group]?.[key])next.parts[group][key].base=previous.parts[group][key].base
   drafts.set(path,next);emitDrafts();if(writeDelay)await writeDelay
   return{outcome:'written',roomDraft:structuredClone(next)}
 }},
 save:async(room,items)=>{saves.push({room,items});for(const item of items)drafts.delete(item.path);emitDrafts();return{outcome:'saved',identifier:'local-queue'}}
}
const host=createHouseBridgeTestHost({address:'/app/a_e.n'});host.attachRuntime(runtime)
globalThis.houseBridge=window.houseBridge=host.port;globalThis.houseRuntime=window.houseRuntime=host.runtime
const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}})
let root
const flush=async()=>{await act(async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve))})}
try {
 const {TasksProvider,useTasks}=await server.ssrLoadModule('/src/features/tasks/components/tasks-provider.tsx')
 const {TasksMutateDrawer}=await server.ssrLoadModule('/src/features/tasks/components/tasks-mutate-drawer.tsx')
 let editing=true
 function Editor(){const {room:active}=useTasks();return h(TasksMutateDrawer,{open:true,currentRow:editing?row:undefined,draftPath:editing?undefined:'tasks/task-creation.md',onOpenChange(){},'data-active':active})}
 const mount=async()=>{const node=document.createElement('div');document.body.append(node);root=createRoot(node);await act(async()=>root.render(h(TasksProvider,null,h(Editor))));await flush()}
 const title=()=>document.querySelector('input[name="title"]')
 const input=async value=>{await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(title(),value);title().dispatchEvent(new window.Event('input',{bubbles:true}));title().dispatchEvent(new window.Event('change',{bubbles:true}))});await flush()}
 await mount();assert.equal(title().value,'Original');assert.equal(title().closest('fieldset').disabled,false)
 await input('unfinished typed title');assert.equal(drafts.get(path).parts.fields.title.value,'unfinished typed title');assert.equal(saves.length,0)
 await input('');assert.equal(drafts.get(path).parts.fields.title.value,'','Invalid partial input is durable before Save')
 await input('survives remount');await act(async()=>root.unmount());await mount();assert.equal(title().value,'survives remount','Actual form rehydrates from durable RoomDraft')
 const prior=drafts.get(path);await act(async()=>{drafts.set(path,{...structuredClone(prior),revision:`draft-${++revision}`,parts:{fields:{...prior.parts.fields,title:{...prior.parts.fields.title,value:'Other tab latest'},status:{value:'done',base:{value:'todo'}}}}});emitDrafts()});await flush();assert.equal(title().value,'Other tab latest');assert.match(document.querySelector('[role="combobox"]').textContent,/Done/)
 let release;writeDelay=new Promise(resolve=>{release=resolve})
 await input('queued first');await input('queued latest');assert.equal(title().value,'queued latest');release();writeDelay=null;await flush();assert.equal(title().value,'queued latest');assert.equal(drafts.get(path).parts.fields.title.value,'queued latest')
 await act(async()=>signals.rooms.emit([]));await flush();assert.equal(title().value,'queued latest');assert.equal(title().closest('fieldset').disabled,true)
 await act(async()=>document.querySelector('#tasks-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await flush();assert.equal(saves.length,0,'Lost reach blocks Save and retains text')
 await act(async()=>{signals.rooms.emit([{locator:room}]);signals['service-mode'].emit('write-halted')});await flush();assert.equal(title().closest('fieldset').disabled,false,'Provider halt does not block local typing')
 await input('queued while provider halted');await act(async()=>document.querySelector('#tasks-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await flush();assert.equal(saves.length,1,'Explicit Save queues locally even while provider uploads are halted')
 await act(async()=>root.unmount());editing=false;await mount();await input('Unfinished new task');assert.equal(drafts.get('tasks/task-creation.md').parts.creation.fields.title,'Unfinished new task');assert.equal(saves.length,1);await act(async()=>root.unmount());await mount();assert.equal(title().value,'Unfinished new task','Unfinished creation resumes at its actual business-document path')
 await act(async()=>{drafts.delete('tasks/task-creation.md');emitDrafts();signals.query.emit({documents:[{room,path,fields:row},{room,path:'tasks/task-creation.md',fields:{...row,id:'TASK-CREATED',title:'Saved from another tab'}}]})});await flush();assert.equal(title().value,'Saved from another tab');await input('Later edit to the saved task');assert.equal(drafts.get('tasks/task-creation.md').parts.creation,undefined,'Another tab saving creation transitions this open drawer to real document fields');assert.equal(drafts.get('tasks/task-creation.md').parts.fields.title.value,'Later edit to the saved task');assert.deepEqual(drafts.get('tasks/task-creation.md').parts.fields.title.base,{value:'Saved from another tab'})
 console.log('PASS: actual Task drawer durable typing, invalid input, remount restoration, cross-tab live title/status, rapid-input acknowledgement ordering, reach-loss preservation, and local Save during provider write halt.')
} finally {if(root)await act(async()=>root.unmount());await server.close();await window.happyDOM.abort()}
