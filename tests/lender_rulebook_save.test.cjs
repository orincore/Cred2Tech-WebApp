const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/pages/LenderConfigPage.jsx'),'utf8');
const validation=require('../src/utils/lenderConfigValidation.js');
const handler=source.slice(source.indexOf('   const handleSaveAll = async'),source.indexOf('   const openSlabEditor'));
async function run(fail=false, maxValue='14%'){const calls=[],messages=[],events=[],saving=[];let pending={cell:{schemeId:4,parameterId:8,value:'12%'}};
const context=vm.createContext({...validation,pendingChanges:pending,selectedProductId:'3',products:[{id:3,product_type:'HL'}],schemes:[{id:4,scheme_name:'Salaried'}],parameters:[{id:8,parameter_key:'hl_roi_min'},{id:9,parameter_key:'hl_roi_max'}],matrixData:{'4_9':maxValue},rulebook:null,Event,
 updateProductMatrix:async(id,changes)=>{calls.push({id,changes:JSON.parse(JSON.stringify(changes))});if(fail)throw{response:{data:{error:'ROI minimum exceeds maximum'}}};return{rulebook:{products:{HL:{schemes:{salaried:{roi:{min:12,max:14}}}}}}};},
 setSavingAll:v=>saving.push(v),setRulebook:()=>{},setMatrixData:()=>{},setPendingChanges:fn=>{pending=fn();},
 localStorage:{setItem:(key,value)=>events.push(key)},window:{dispatchEvent:e=>events.push(e.type)},toast:{error:m=>messages.push(['error',m]),success:m=>messages.push(['success',m])}});
await vm.runInContext(handler+'\nhandleSaveAll();',context);return{calls,messages,events,saving,pending};}
test('matrix save submits one atomic request and signals open ESR tabs only after success',async()=>{const r=await run();assert.deepEqual(r.calls,[{id:'3',changes:[{scheme_id:4,parameter_id:8,value:'12%'}]}]);assert.equal(Object.keys(r.pending).length,0);assert.deepEqual(r.events,['esr-policy-updated','esr-policy-updated']);assert.deepEqual(r.saving,[true,false]);assert.equal(r.messages[0][0],'success');});
test('validation errors retain edits, show the backend reason and never refresh ESR',async()=>{const r=await run(true);assert.equal(Object.keys(r.pending).length,1);assert.deepEqual(r.events,[]);assert.deepEqual(r.messages,[['error','ROI minimum exceeds maximum']]);assert.deepEqual(r.saving,[true,false]);});
test('invalid range is caught before any save request and retains the pending edit',async()=>{const r=await run(false,'10%');assert.equal(r.calls.length,0);assert.equal(Object.keys(r.pending).length,1);assert.deepEqual(r.events,[]);assert.match(r.messages[0][1],/minimum \(12%\) exceeds maximum \(10%\)/);});
