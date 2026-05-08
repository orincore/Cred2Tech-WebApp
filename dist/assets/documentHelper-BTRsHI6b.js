import{c,q as p}from"./index-BCAITjwh.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r=c("CloudUpload",[["path",{d:"M12 13v8",key:"1l5pq0"}],["path",{d:"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242",key:"1pljnt"}],["path",{d:"m8 17 4-4 4 4",key:"1quai1"}]]);async function l(t,n){const a=await p.get(`/documents/${t}/download`,{responseType:"blob"}),e=new Blob([a.data],{type:a.headers["content-type"]}),d=window.URL.createObjectURL(e),o=document.createElement("a");o.href=d,o.download=n||`document_${t}`,document.body.appendChild(o),o.click(),o.remove(),window.URL.revokeObjectURL(d)}async function u(t,n,a){const e=new FormData;return e.append("file",t),e.append("case_id",n),e.append("document_type",a),(await p.post("/documents/upload",e,{headers:{"Content-Type":"multipart/form-data"}})).data}export{r as C,l as d,u};
