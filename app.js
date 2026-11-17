pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const docs={context:"",persona:"",insight:""};
const files={context:null,persona:null,insight:null};
let lastAnalysis=null;
const $=id=>document.getElementById(id);

const slots=[
  {key:"context",input:"contextFile",status:"contextStatus"},
  {key:"persona",input:"personaFile",status:"personaStatus"},
  {key:"insight",input:"insightFile",status:"insightStatus"}
];

async function extractPdfText(file){
  const buffer=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buffer}).promise;
  let out=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const content=await page.getTextContent();
    const text=content.items.map(i=>i.str).join(" ");
    out.push(`[Página ${p}] ${text}`);
  }
  return out.join("\n").trim();
}
function updateReady(){
  const count=Object.values(files).filter(Boolean).length;
  $("readyBadge").textContent=`${count} / 3 cargados`;
  $("analyzeBtn").disabled=count===0;
}
slots.forEach(({key,input,status})=>{
  $(input).addEventListener("change",async e=>{
    const file=e.target.files?.[0];if(!file)return;
    files[key]=file;
    const card=e.target.closest(".drop-card");
    $(status).textContent="Leyendo PDF...";
    try{
      const text=await extractPdfText(file);
      docs[key]=text;
      if(!text||text.length<30){
        $(status).textContent="PDF cargado, pero sin texto legible";
        card.classList.add("loaded");
      }else{
        $(status).textContent=`${file.name} · ${Math.round(text.length/1000)}k caracteres`;
        card.classList.add("loaded");
      }
    }catch(err){
      files[key]=null;docs[key]="";card.classList.remove("loaded");
      $(status).textContent="No se pudo leer el PDF";
    }
    updateReady();
  })
});

function safeText(v,fallback="—"){return (v&&String(v).trim())||fallback}
function routeCard(r,i){
  return `<article class="route-card">
    <span class="route-num">RUTA ${i+1}</span>
    <h3>${escapeHtml(safeText(r.name,"Concepto"))}</h3>
    <div class="route-headline">${escapeHtml(safeText(r.headline))}</div>
    <div class="route-section"><strong>Submensaje</strong><p>${escapeHtml(safeText(r.subheadline))}</p></div>
    <div class="route-section"><strong>Dirección visual</strong><p>${escapeHtml(safeText(r.visual_direction))}</p></div>
    <div class="route-section"><strong>Jerarquía</strong><p>${escapeHtml((r.hierarchy||[]).join(" → "))}</p></div>
    <div class="route-section"><strong>CTA</strong><p>${escapeHtml(safeText(r.cta))}</p></div>
    <div class="why"><strong>Por qué puede funcionar:</strong> ${escapeHtml(safeText(r.why))}</div>
  </article>`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function render(a){
  lastAnalysis=a;
  $("apparentProduct").textContent=safeText(a.apparent_product);
  $("realJob").textContent=safeText(a.real_job);
  $("tension").textContent=safeText(a.main_tension);
  $("emotion").textContent=safeText(a.primary_emotion);
  $("creativeInsight").textContent=`“${safeText(a.creative_insight)}”`;
  $("insightWhy").textContent=safeText(a.insight_rationale);
  $("think").textContent=safeText(a.think);
  $("feel").textContent=safeText(a.feel);
  $("do").textContent=safeText(a.do);
  $("centralMessage").textContent=safeText(a.central_message);
  $("promise").textContent=safeText(a.promise);
  $("routes").innerHTML=(a.routes||[]).slice(0,3).map(routeCard).join("");
  $("imagePrompt").textContent=safeText(a.image_prompt);
  $("resultsSection").hidden=false;
  $("resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
}
async function api(payload){
  const res=await fetch("/analyze",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||`Error ${res.status}`);
  return data;
}
$("analyzeBtn").addEventListener("click",async()=>{
  $("parseStatus").textContent="";
  $("loadingSection").hidden=false;
  $("analyzeBtn").disabled=true;
  try{
    const total=Object.values(docs).join("").length;
    if(total<50) throw new Error("Los PDFs no contienen texto extraíble suficiente.");
    const data=await api({
      mode:"analyze",
      documents:docs,
      extra_instruction:$("extraInstruction").value.trim()
    });
    render(data.analysis);
  }catch(err){
    $("parseStatus").textContent=err.message.includes("Failed to fetch")
      ?"No pude conectar con el backend. Verifica que el proyecto esté desplegado en Vercel y tenga OPENAI_API_KEY."
      :err.message;
  }finally{
    $("loadingSection").hidden=true;
    $("analyzeBtn").disabled=false;
  }
});
$("copyPromptBtn").addEventListener("click",async()=>{
  await navigator.clipboard.writeText($("imagePrompt").textContent);
  const old=$("copyPromptBtn").textContent;$("copyPromptBtn").textContent="Copiado";
  setTimeout(()=>$("copyPromptBtn").textContent=old,1200);
});
$("downloadBriefBtn").addEventListener("click",()=>{
  if(!lastAnalysis)return;
  const text=[
    "FLYER STRATEGIST · BRIEF CREATIVO",
    "",
    `Producto aparente: ${safeText(lastAnalysis.apparent_product)}`,
    `Lo que realmente busca: ${safeText(lastAnalysis.real_job)}`,
    `Tensión: ${safeText(lastAnalysis.main_tension)}`,
    `Emoción: ${safeText(lastAnalysis.primary_emotion)}`,
    "",
    `INSIGHT:\n${safeText(lastAnalysis.creative_insight)}`,
    "",
    `MENSAJE CENTRAL:\n${safeText(lastAnalysis.central_message)}`,
    `PROMESA:\n${safeText(lastAnalysis.promise)}`,
    "",
    ...(lastAnalysis.routes||[]).map((r,i)=>`RUTA ${i+1} · ${r.name}\nGancho: ${r.headline}\nSubmensaje: ${r.subheadline}\nVisual: ${r.visual_direction}\nCTA: ${r.cta}\nPor qué: ${r.why}\n`),
    "\nPROMPT PARA IMAGEN:\n"+safeText(lastAnalysis.image_prompt)
  ].join("\n");
  const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="brief-creativo-flyer.txt";a.click();URL.revokeObjectURL(a.href);
});
async function sendChat(){
  const msg=$("chatInput").value.trim();if(!msg||!lastAnalysis)return;
  addBubble(msg,"user");$("chatInput").value="";$("sendChatBtn").disabled=true;
  try{
    const data=await api({
      mode:"chat",
      documents:docs,
      analysis:lastAnalysis,
      message:msg
    });
    addBubble(data.reply,"bot");
  }catch(err){addBubble("No pude responder: "+err.message,"bot")}
  finally{$("sendChatBtn").disabled=false}
}
function addBubble(text,type){
  const div=document.createElement("div");div.className=`bubble ${type}`;div.textContent=text;
  $("chatMessages").appendChild(div);$("chatMessages").scrollTop=$("chatMessages").scrollHeight;
}
$("sendChatBtn").addEventListener("click",sendChat);
$("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat()}});
$("resetBtn").addEventListener("click",()=>location.reload());
updateReady();
