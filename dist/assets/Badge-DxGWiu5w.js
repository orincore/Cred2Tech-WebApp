import{e as n,j as c}from"./index-GyY8_rJ1.js";import{a as i}from"./roles-CDfG9U1g.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=n("Calendar",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]]),b=({type:s="role",value:r,className:l=""})=>{if(!r)return c.jsx("span",{style:{color:"var(--text-tertiary)"},children:"—"});let e,a,t;if(s==="role"){const o=i[r]||{};e=o.color||"var(--text-secondary)",a=o.bg||"var(--bg-elevated)",t=o.name||r}else s==="status"?r==="ACTIVE"?(e="var(--success)",a="var(--success-bg)",t="Active"):(e="var(--text-tertiary)",a="var(--bg-elevated)",t="Inactive"):s==="level"?(e="var(--info)",a="var(--info-bg)",t=r):(e="var(--text-secondary)",a="var(--bg-elevated)",t=r);return c.jsx("span",{className:`badge ${l}`,style:{color:e,backgroundColor:a,border:`1px solid ${e}22`},children:t})};export{b as B,x as C};
