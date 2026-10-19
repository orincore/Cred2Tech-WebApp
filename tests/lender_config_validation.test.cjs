const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateLenderMatrixChanges:validate,lenderSaveError}=require('../src/utils/lenderConfigValidation.js');
const fixture=()=>({productType:'LAP',schemes:[{id:2,scheme_name:'Banking'}],parameters:[{id:10,parameter_key:'lap_roi_min'},{id:11,parameter_key:'lap_roi_max'}],changes:[{schemeId:2,parameterId:10,value:'11%'}],matrixData:{'2_10':{raw:'8.25%'},'2_11':{raw:'10%'}},rulebook:null});
test('ICICI screenshot: minimum 11% and maximum 10% shows the precise corrective message',()=>{
 assert.equal(validate(fixture()),'Banking: ROI minimum (11%) exceeds maximum (10%). Lower the minimum or increase the maximum, then save both changes together.');
});
test('editing both range limits together is permitted and uses string IDs correctly',()=>{
 const f=fixture();f.changes.push({schemeId:'2',parameterId:'11',value:'12%'});assert.equal(validate(f),null);
});
test('effective rulebook values take priority over obsolete matrix seed values',()=>{
 const f=fixture();f.rulebook={product:{roi:{min:8.25,max:15}},methods:[{scheme_id:2,rule:{}}]};assert.equal(validate(f),null);
 f.rulebook.methods[0].rule.roi={min:8.25,max:9};assert.match(validate(f),/maximum \(9%\)/);
});
test('clearing a range override is delegated to baseline-aware server validation',()=>{
 const f=fixture();f.changes[0].value='';assert.equal(validate(f),null);
});
test('a different method or product cannot provide the comparison range',()=>{
 const f=fixture();f.matrixData['3_11']='15%';assert.match(validate(f),/maximum \(10%\)/);
 f.productType='HL';assert.equal(validate(f),null);
});
test('network and route errors are not incorrectly described as rulebook validation failures',()=>{
 assert.match(lenderSaveError(new Error('Network Error')),/Cannot reach the API/);
 assert.match(lenderSaveError({response:{status:404,data:'Cannot PUT'}}),/updated backend/);
 assert.equal(lenderSaveError({response:{status:400,data:{error:'Banking: ROI min 11 > max 10'}}}),'Banking: ROI min 11 > max 10');
});
