import { assertQueryPointers, strictQueryObservation } from './query-contract.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Window } from 'happy-dom'
import { createHouseBridgeTestHost } from '@agentshouse/app-bridge/test-host'
import { createServer } from 'vite'
const window = new Window({url:'http://localhost/#tasks'})
for(const name of ['window','document','navigator','location','history','HTMLElement','Element','Node','NodeFilter','Text','Event','CustomEvent','FocusEvent','MouseEvent','KeyboardEvent','InputEvent','MutationObserver','ResizeObserver','FileList','File','DocumentFragment','HTMLInputElement','HTMLButtonElement','HTMLFormElement','HTMLSelectElement','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']){const value=name==='window'?window:window[name];if(value!==undefined)Object.defineProperty(globalThis,name,{configurable:true,value:typeof value==='function'&&/^[a-z]/.test(name)?value.bind(window):value})}
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const {createElement:h,act}=await import('react'),{createRoot}=await import('react-dom/client')
const signal=initial=>{let value=initial;const listeners=new Set();return{current:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},close(){},emit(next){value=next;listeners.forEach(fn=>fn(next))}}}
const room='whole-demo-room'
let records=JSON.parse(fs.readFileSync('tests/support/fixtures/donor-workspace.json')).map(record=>({...record,room}))
const tasks=JSON.parse(fs.readFileSync('tests/support/fixtures/donor-tasks.json')).map((fields,index)=>({room,path:`tasks/donor-${index}.md`,type:'task',fields}))
records.push(...tasks)
const drafts=new Map(),saves=[];let revision=0,queryCount=0
const signals={rooms:signal([{locator:room}]),'sync-status':signal({lastCompleted:'complete',attentionRequired:[]}),'room-drafts':signal([]),'service-mode':signal('open'),'connection-refusal':signal(null),query:signal({documents:records}),tasks:signal({documents:tasks}),presentation:signal({})}
const emitDrafts=()=>signals['room-drafts'].emit([...drafts.values()].map(value=>structuredClone(value)))
const runtime={observe:async(kind,query)=>{if(kind==='query'){assertQueryPointers(query);queryCount++;return strictQueryObservation(query,query.types?signals.tasks:signals.query)}return signals[kind]},presentation:{read:async()=>({}),write:async value=>signals.presentation.emit(value)},roomDraft:{read:async(_room,path)=>structuredClone(drafts.get(path)??null),write:async(room,path,seen,parts)=>{const prior=drafts.get(path);if((prior?.revision??null)!==seen)return{outcome:'stale',current:structuredClone(prior)};const next={room,path,revision:`draft-${++revision}`,parts:structuredClone(parts),returned:null,changedUnderneath:{}};for(const key of Object.keys(next.parts.fields??{}))if(prior?.parts.fields?.[key])next.parts.fields[key].base=prior.parts.fields[key].base;drafts.set(path,next);emitDrafts();return{outcome:'written',roomDraft:structuredClone(next)}}},save:async(room,items)=>{saves.push({room,items});for(const item of items){const draft=drafts.get(item.path);if(draft.parts.creation)records.push({room,path:item.path,type:draft.parts.creation.type,fields:draft.parts.creation.fields});else{const record=records.find(record=>record.path===item.path);for(const[name,field]of Object.entries(draft.parts.fields??{}))record.fields[name]=field.value}drafts.delete(item.path)}signals.query.emit({documents:[...records]});emitDrafts();return{outcome:'saved',identifier:'local-queue'}}}
const host=createHouseBridgeTestHost({address:'/app/a_e.n'});host.attachRuntime(runtime);
const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}})
let root
const flush=async()=>{await act(async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve))})}
try{
 const{App}=await server.ssrLoadModule('/src/App.tsx'),{ThemeProvider}=await server.ssrLoadModule('/src/context/theme-provider.tsx'),{DirectionProvider}=await server.ssrLoadModule('/src/context/direction-provider.tsx')
 const mount=async()=>{const node=document.createElement('div');document.body.append(node);root=createRoot(node);await act(async()=>root.render(h(ThemeProvider,null,h(DirectionProvider,null,h(App)))));await flush()}
 const navigate=async module=>{await act(async()=>document.querySelector(`a[href="#${module}"]`).click());await flush();assert.equal(document.querySelector(`[data-module="${module}"]`).hidden,false)}
 const input=async value=>{await act(async()=>{const element=document.querySelector('[data-module="chats"] input[placeholder="Type your messages..."]');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new window.Event('input',{bubbles:true}));element.dispatchEvent(new window.Event('change',{bubbles:true}))});await flush()}
 const chooseChat=async()=>{await act(async()=>[...document.querySelectorAll('[data-module="chats"] button')].find(button=>button.textContent.includes('Alex John')).click());await flush()}
 await mount();assert.equal(document.querySelectorAll('[data-module]').length,6);const initialQueries=queryCount
 for(const module of ['dashboard','chats','users','apps','settings','tasks'])await navigate(module)
 assert.equal(queryCount,initialQueries,'Navigation never performs a new Room query or module load')
 assert.equal(document.querySelectorAll('[data-module="apps"] li').length,15)
 assert.match(document.querySelector('[data-module="users"]').textContent,/Page 1 of 50/)
 assert.match(document.querySelector('[data-module="dashboard"]').textContent, /45,231.89/)
 assert.equal(document.querySelectorAll('img[src^="https:"]').length,0,'No external portrait request')
 await navigate('chats');await chooseChat();await input('Room message draft')
 let draft=[...drafts.values()].find(draft=>draft.parts.creation?.type==='chat-message');assert(draft);assert.equal(draft.parts.creation.fields.message,'Room message draft');assert.equal(draft.parts.creation.fields.conversation,'conv1');assert.equal(saves.length,0,'Typing never sends')
 await navigate('users');await navigate('chats');assert.equal(document.querySelector('[data-module="chats"] input[placeholder="Type your messages..."]').value,'Room message draft')
 await act(async()=>root.unmount());await mount();await navigate('chats');await chooseChat();assert.equal(document.querySelector('[data-module="chats"] input[placeholder="Type your messages..."]').value,'Room message draft','Composer hydrates actual message creation draft')
 const prior=drafts.get(draft.path);await act(async()=>{drafts.set(prior.path,{...prior,revision:`draft-${++revision}`,parts:{creation:{...prior.parts.creation,fields:{...prior.parts.creation.fields,message:'Other tab typed this'}}}});emitDrafts()});await flush();assert.equal(document.querySelector('[data-module="chats"] input[placeholder="Type your messages..."]').value,'Other tab typed this')
 await act(async()=>signals['service-mode'].emit('write-halted'));await flush();await act(async()=>document.querySelector('[data-module="chats"] button[aria-label="Send to Room"]').click());await flush()
 assert.equal(saves.length,1);assert(records.some(record=>record.type==='chat-message'&&record.fields.message==='Other tab typed this'));assert.equal(document.querySelector('[data-module="chats"] input[placeholder="Type your messages..."]').value,'','Send queues the message and opens a new composition')
 await input('Next message');assert.equal([...drafts.values()].filter(draft=>draft.parts.creation?.type==='chat-message').length,1)
 const draftCount=drafts.size;await act(async()=>signals.rooms.emit([]));await flush();assert.equal(document.querySelector('[data-module="chats"] button[aria-label="Send to Room"]').disabled,true);assert.equal(drafts.size,draftCount)
 console.log('PASS: six mounted donor modules, instant local navigation with no extra queries, all 500 users/15 Apps/metrics, no portrait fetch, actual chat-message drafts, cross-tab redraw, reload hydration, explicit Room Send under provider halt, new composition, and reach-loss protection.')
}finally{if(root)await act(async()=>root.unmount());await server.close();await window.happyDOM.abort()}
