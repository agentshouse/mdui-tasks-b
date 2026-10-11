import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {verify,validate,parse} from '../node_modules/@agentshouse/app-bridge/node_modules/@agentshouse/mdmodel/dist/index.js'
const schema=fs.readFileSync('schema.yaml','utf8')
const verified=verify(schema)
assert.equal(verified.verdict,'accept',JSON.stringify(verified))
const fixture=JSON.parse(fs.readFileSync('tests/support/fixtures/donor-workspace.json','utf8'))
const batches=fs.readdirSync('tests/support/whole-demo').filter(name=>/^batch-\d+\.json$/.test(name)).flatMap(name=>JSON.parse(fs.readFileSync(path.join('tests/support/whole-demo',name))).changes)
assert.equal(fixture.length,572)
assert.equal(batches.length,fixture.length)
const library={'settings/schema.yaml':schema}
for(let index=0;index<fixture.length;index++){
 const item=fixture[index],change=batches[index];assert.equal(change.path,`/rooms/tasks-pilot/${item.path}`)
 const parsed=parse(change.content,item.path);assert.equal(parsed.ok,true,JSON.stringify(parsed));assert.equal(parsed.document.type,item.type);assert.deepEqual(JSON.parse(JSON.stringify(parsed.document.fields)),{type:item.type,...item.fields})
 library[item.path]=change.content
}
const validation=validate(library,undefined,verified.model);assert.equal(validation.verdict,'accept',JSON.stringify(validation))
for(const [type,count]of Object.entries({'workspace-user':500,conversation:10,integration:15,dashboard:1,profile:1,account:1,'notification-preferences':1,'chat-message':43}))assert.equal(fixture.filter(item=>item.type===type).length,count)
const donor=JSON.parse(fs.readFileSync('tests/support/fixtures/donor-original-conversations.json')).conversations
for(const conversation of donor){const record=fixture.find(record=>record.type==='conversation'&&record.fields.id===conversation.id);const {messages,...fields}=conversation;assert.deepEqual(record.fields,fields);const restored=fixture.filter(record=>record.type==='chat-message'&&record.fields.conversation===conversation.id).map(record=>{const {conversation,...fields}=record.fields;return fields});assert.deepEqual(restored,messages)}
const app=fs.readFileSync('src/App.tsx','utf8');for(const name of ['Dashboard','Tasks','Chats','Users','Apps','Settings'])assert.match(app,new RegExp(`<${name}\\s*/>`))
assert.doesNotMatch(app,/import\(|React\.lazy|window\.location\s*=/)
const manifest=JSON.parse(fs.readFileSync('app.json'));assert.equal(manifest.room_slots.length,1);assert.equal(manifest.room_slots[0].name,'tasks');assert.equal(manifest.room_slots[0].types.length,9)
console.log('PASS: all 572 added donor documents round-trip exactly through installed MD Model, schema accepts, all 43 donor messages retained, one existing slot and six eager SPA modules.')
