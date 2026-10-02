const STORAGE_KEY = "oficina-app-v1";
const STAGES = ["Projeto fechado", "Corte", "Pré-montagem", "Montagem", "Embalagem", "Frete", "Montagem do ambiente", "Montagem concluída"];
const CHECKLIST = {
  "Conferência dos móveis": ["Portas abrem e fecham sem agarrar", "Gavetas abrem e fecham corretamente", "Acionadores e ferragens estão funcionando", "Painéis instalados e conferidos, quando houver"],
  "Acabamento e limpeza": ["MDF limpo, sem pó de madeira", "Ambiente limpo ao final do serviço", "Pintura conferida, quando houver", "Móvel entregue previamente limpo"],
  "Inspeção visual": ["Sem avarias visíveis nas áreas externas", "Acabamentos e alinhamentos conferidos", "Todos os ambientes e itens do projeto revisados"]
};
const QUICK_CHECKLIST = [
  ["Uso e funcionamento", ["Testei todas as portas com o cliente; abrem e fecham sem agarrar", "Testei acionadores e ferragens; estão funcionando", "Abri todas as gavetas com o cliente e conferi o deslizamento", "Conferi painéis instalados e seus acabamentos, quando houver"]],
  ["Acabamento e limpeza", ["MDF está limpo, sem pó de madeira", "Móvel foi entregue previamente limpo", "Ambiente ficou limpo após a montagem", "Pintura está concluída e conferida ou marcada como não aplicável"]],
  ["Inspeção visual", ["Não há avarias visíveis nas áreas externas", "Conferi alinhamentos, folgas e acabamentos"]]
];
const state = loadState();
let currentView = "dashboard";
let selectedAssembly = null;
let toastTimer;

function loadState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {clients:[],projects:[],transactions:[]}; }
  catch { return {clients:[],projects:[],transactions:[]}; }
}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function esc(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(value){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value)||0);}
function dateBR(value){if(!value)return "—";const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("pt-BR");}
function todayISO(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
function clientName(id){return state.clients.find(c=>c.id===id)?.name||"Cliente sem cadastro";}
function projectProgress(project){const i=STAGES.indexOf(project.stage||STAGES[0]);return Math.round((Math.max(0,i)/(STAGES.length-1))*100);}
function statusTone(stage){return stage==="Montagem concluída"?"green":stage==="Corte"?"gray":stage==="Frete"||stage==="Montagem do ambiente"?"amber":"blue";}
function activeProjects(){return state.projects.filter(p=>p.stage!=="Montagem concluída");}
function showToast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2700);}
function initials(name="?"){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();}
function render(){
  const labels={dashboard:"Visão geral",projects:"Projetos",production:"Produção",assembly:"Montagem e entrega",clients:"Clientes",finance:"Financeiro"};
  document.getElementById("crumb").textContent=labels[currentView]||"Projeto";
  document.getElementById("projectCount").textContent=state.projects.length;
  document.getElementById("today").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"});
  const root=document.getElementById("app");
  const routes={dashboard:renderDashboard,projects:renderProjects,production:renderProduction,assembly:renderAssembly,clients:renderClients,finance:renderFinance};
  root.innerHTML=(routes[currentView]||renderDashboard)();
  bindViewEvents();
}
function pageHead(kicker,title,subtitle,action=""){
  return `<div class="heading-row"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div>${action?`<div class="actions">${action}</div>`:""}</div>`;
}
function renderDashboard(){
  const income=state.transactions.filter(t=>t.type==="entrada").reduce((s,t)=>s+Number(t.amount||0),0);
  const expenses=state.transactions.filter(t=>t.type==="saída").reduce((s,t)=>s+Number(t.amount||0),0);
  const active=activeProjects();
  const next=active.slice(0,4);
  const recent=[...state.transactions].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5);
  return `${pageHead("PAINEL DA OFICINA","Bom dia","Acompanhe projetos, produção e resultado das obras em um só lugar.",`<button class="btn" data-action="new-client">＋ Cliente</button><button class="btn primary" data-action="new-project">＋ Novo projeto</button>`)}
    <section class="cards metrics">
      <div class="card"><div class="metric-top">Projetos em andamento<span class="metric-icon">▦</span></div><div class="metric-value">${active.length}</div><div class="metric-sub">${state.projects.length} projetos cadastrados</div></div>
      <div class="card"><div class="metric-top">Entradas registradas<span class="metric-icon">↙</span></div><div class="metric-value">${money(income)}</div><div class="metric-sub">Soma dos lançamentos cadastrados</div></div>
      <div class="card"><div class="metric-top">Saídas registradas<span class="metric-icon">↗</span></div><div class="metric-value">${money(expenses)}</div><div class="metric-sub">Inclui mão de obra, escritório, gasolina e outros</div></div>
      <div class="card"><div class="metric-top">Saldo registrado<span class="metric-icon">＝</span></div><div class="metric-value">${money(income-expenses)}</div><div class="metric-sub">Entradas menos saídas registradas</div></div>
    </section>
    <section class="dashboard-grid">
      <div class="card"><div class="section-head"><h2>Projetos em andamento</h2><button class="text-link" data-view="projects">Ver projetos →</button></div>${next.length?`<div class="project-list">${next.map(p=>`<div class="project-row"><div><div class="project-title">${esc(p.name)}</div><div class="project-sub">${esc(clientName(p.clientId))} · ${esc(p.environment||"Ambientes a definir")}</div></div><div><div class="progress-label"><span>${esc(p.stage||STAGES[0])}</span><span>${projectProgress(p)}%</span></div><div class="progress"><span style="width:${projectProgress(p)}%"></span></div></div><span class="badge ${statusTone(p.stage)}">${esc(p.stage||STAGES[0])}</span></div>`).join("")}</div>`:`<div class="empty-state"><b>Nenhum projeto cadastrado ainda</b>Cadastre uma obra para começar a acompanhar as etapas.<br><button class="btn primary small" data-action="new-project" style="margin-top:12px">＋ Cadastrar projeto</button></div>`}</div>
      <div class="card"><div class="section-head"><h2>Movimentações recentes</h2><button class="text-link" data-view="finance">Abrir financeiro →</button></div>${recent.length?`<div class="feed">${recent.map(t=>`<div class="feed-item"><div class="feed-icon">${t.type==="entrada"?"↙":"↗"}</div><div class="feed-copy"><b>${esc(t.description)}</b> · ${esc(projectLabel(t.projectId))}<small>${dateBR(t.date)} · ${esc(t.category)} <span style="float:right;color:${t.type==="entrada"?"#438263":"#b26358"};font-weight:700">${t.type==="entrada"?"+":"−"}${money(t.amount)}</span></small></div></div>`).join("")}</div>`:`<div class="empty-state"><b>Sem movimentações registradas</b>As entradas e despesas aparecerão aqui por projeto.</div>`}</div>
    </section>
    <div class="card"><div class="section-head"><h2>Etapas acompanhadas</h2><button class="text-link" data-view="production">Abrir quadro de produção →</button></div><div class="cards" style="grid-template-columns:repeat(4,1fr)">${STAGES.slice(0,4).map((s,i)=>`<div class="detail-tile"><label>ETAPA ${String(i+1).padStart(2,"0")}</label><strong>${s}</strong><div class="metric-sub" style="margin-top:5px">${state.projects.filter(p=>p.stage===s).length} projetos</div></div>`).join("")}</div></div>
    <p class="disclaimer">Protótipo: o saldo considera somente os lançamentos feitos no aplicativo. Não é um demonstrativo contábil nem considera impostos, taxas ou custos ainda não registrados.</p>`;
}
function projectLabel(id){const p=state.projects.find(x=>x.id===id);return p? p.name:"Sem projeto vinculado";}
function renderProjects(){
 const q=(document.getElementById("projectSearch")?.value||"").toLowerCase();
 const rows=state.projects.filter(p=>`${p.name} ${clientName(p.clientId)} ${p.stage}`.toLowerCase().includes(q));
 return `${pageHead("ACOMPANHAMENTO","Projetos","Cada obra tem seu cliente, valor contratado, etapas, entregas e resultado financeiro.",`<button class="btn primary" data-action="new-project">＋ Novo projeto</button>`)}
  <div class="toolbar"><label class="search">⌕ <input id="projectSearch" placeholder="Buscar projeto ou cliente" value="${esc(q)}"></label><select class="filter" id="projectFilter"><option value="todos">Todas as etapas</option>${STAGES.map(s=>`<option>${s}</option>`).join("")}</select><span class="grow"></span><span class="metric-sub">${rows.length} projetos</span></div>
  <div class="card table-card"><div class="table-wrap"><table><thead><tr><th>Projeto / cliente</th><th>Etapa atual</th><th>Valor contratado</th><th>Próximo marco</th><th>Progresso</th><th></th></tr></thead><tbody>${rows.length?rows.map(p=>`<tr data-stage="${esc(p.stage||STAGES[0])}"><td><strong>${esc(p.name)}</strong><div class="project-sub">${esc(clientName(p.clientId))} · ${esc(p.environment||"Ambientes a definir")}</div></td><td><span class="badge ${statusTone(p.stage)}">${esc(p.stage||STAGES[0])}</span></td><td>${money(p.value)}</td><td>${esc(p.milestone||"A definir")}</td><td><div class="progress-label"><span>${projectProgress(p)}%</span></div><div class="progress" style="width:100px"><span style="width:${projectProgress(p)}%"></span></div></td><td><button class="table-action" data-action="project-detail" data-id="${p.id}">Abrir</button> <button class="table-action" data-action="project-environments" data-id="${p.id}">Ambientes</button></td></tr>`).join(""):`<tr><td colspan="6"><div class="empty-state"><b>Nenhum projeto encontrado</b>Cadastre um projeto fechado para começar o acompanhamento.</div></td></tr>`}</tbody></table></div></div>`;
}
function renderClients(){
 const q=(document.getElementById("clientSearch")?.value||"").toLowerCase();
 const rows=state.clients.filter(c=>`${c.name} ${c.phone||""} ${c.email||""}`.toLowerCase().includes(q));
 return `${pageHead("RELACIONAMENTO","Clientes","Cadastre os dados de contato usados no projeto, contrato e agendamento.",`<button class="btn secondary" data-action="invite-info">↗ Preparar link de cadastro</button><button class="btn primary" data-action="new-client">＋ Novo cliente</button>`)}
  <div class="note-box">O cadastro por link será conectado ao banco de dados na etapa de autenticação. Neste protótipo, os dados ficam apenas neste navegador.</div>
  <div class="toolbar"><label class="search">⌕ <input id="clientSearch" placeholder="Buscar nome, telefone ou e-mail" value="${esc(q)}"></label><span class="grow"></span><span class="metric-sub">${rows.length} clientes</span></div>
  <div class="card table-card"><div class="table-wrap"><table style="min-width:560px"><thead><tr><th>Cliente</th><th>Telefone</th><th>E-mail</th><th>Projetos</th><th></th></tr></thead><tbody>${rows.length?rows.map(c=>`<tr><td><div class="client-cell"><span class="client-avatar">${initials(c.name)}</span><div><strong>${esc(c.name)}</strong><div class="project-sub">${esc(c.address||"Endereço não informado")}</div></div></div></td><td>${esc(c.phone||"—")}</td><td>${esc(c.email||"—")}</td><td>${state.projects.filter(p=>p.clientId===c.id).length}</td><td><button class="table-action" data-action="client-detail" data-id="${c.id}">Ver</button></td></tr>`).join(""):`<tr><td colspan="5"><div class="empty-state"><b>Seus clientes aparecerão aqui</b>Cadastre um cliente ou associe um novo projeto a um cadastro.</div></td></tr>`}</tbody></table></div></div>`;
}
function renderProduction(){
 const buckets=STAGES.map(stage=>({stage,projects:state.projects.filter(p=>(p.stage||STAGES[0])===stage)}));
 return `${pageHead("CHÃO DE FÁBRICA","Produção","Veja em que etapa cada projeto está e avance a obra conforme o trabalho acontece.",`<button class="btn" data-action="new-project">＋ Novo projeto</button>`)}<div class="note-box">O avanço é registrado por projeto neste protótipo. A programação detalhada por ambiente, responsável e data pode ser adicionada sem alterar o histórico da obra.</div><div class="board">${buckets.map((b,i)=>`<section class="board-col"><div class="board-head"><span>${esc(b.stage)}</span><span>${b.projects.length}</span></div>${b.projects.length?b.projects.map(p=>`<article class="board-card"><h3>${esc(p.name)}</h3><p>${esc(clientName(p.clientId))} · ${esc(p.environment||"Ambiente a definir")}</p><div class="stage-line"><span>${money(p.value)}</span><button class="table-action" data-action="advance-stage" data-id="${p.id}">${i===STAGES.length-1?"Concluído":"Avançar →"}</button></div><div class="progress"><span style="width:${projectProgress(p)}%"></span></div></article>`).join(""):`<div style="font-size:9px;color:#9ba59f;padding:10px 2px">Sem projetos nesta etapa</div>`}</section>`).join("")}</div>`;
}
function renderAssembly(){
 const projects=state.projects.filter(p=>p.stage==="Montagem do ambiente"||p.stage==="Montagem concluída");
 const selected=projects.find(p=>p.id===selectedAssembly)||projects[0];if(selected&&!selectedAssembly)selectedAssembly=selected.id;
 if(!selected)return renderQuickAssembly();
 const checks=selected.checks||{};
 return `${pageHead("CONFERÊNCIA FINAL","Montagem e entrega","Faça a conferência junto com o cliente e registre os itens antes da assinatura de conclusão.")}
  <div class="assembly-layout"><div class="card"><div class="section-head"><h2>Obras para conferir</h2><span class="badge gray">${projects.length}</span></div><div class="project-select-list">${projects.map(p=>`<button class="select-project ${p.id===selected.id?"selected":""}" data-action="select-assembly" data-id="${p.id}"><strong>${esc(p.name)}</strong><span>${esc(clientName(p.clientId))} · ${esc(p.stage)}</span></button>`).join("")}</div></div>
  <div class="card"><div class="section-head"><div><h2>${esc(selected.name)}</h2><div class="project-sub">${esc(clientName(selected.clientId))} · ${esc(selected.environment||"Ambientes a definir")}</div></div><span class="badge ${selected.stage==="Montagem concluída"?"green":"amber"}">${esc(selected.stage)}</span></div><div class="note-box">Revise cada item com o cliente. A garantia deve usar como referência a data real de conclusão registrada na entrega.</div>${Object.entries(CHECKLIST).map(([section,items])=>`<div class="checklist-section"><h3>${section}</h3>${items.map((label,i)=>{const key=`${section}-${i}`;return `<label class="check-item"><input type="checkbox" data-check="${esc(key)}" ${checks[key]?"checked":""}><span>${esc(label)}</span></label>`}).join("")}</div>`).join("")}
  <div class="signature-box"><p>Ao concluir, registre o nome do cliente e a confirmação de aceite. Esta assinatura digitada é somente demonstrativa; assinatura formal exige integração própria.</p><div class="signature-row"><input class="field-input" id="acceptName" placeholder="Nome do cliente que acompanhou" value="${esc(selected.acceptedBy||"")}" style="border:1px solid #dfe5e1;border-radius:7px;padding:9px;font-size:10px"><button class="btn primary" data-action="complete-assembly" data-id="${selected.id}">Registrar conclusão</button></div>${selected.completedAt?`<div class="project-sub" style="margin-top:8px">Conclusão registrada em ${dateBR(selected.completedAt)} · ${esc(selected.acceptedBy||"")}</div>`:""}</div></div></div>`;
}
function quickChecklistState(){
 if(!state.quickChecklist)state.quickChecklist={work:"",client:"",address:"",checks:{},signer:"",signatureData:"",completedAt:""};
 return state.quickChecklist;
}
function renderQuickAssembly(){
 const q=quickChecklistState();
 return `${pageHead("FINALIZAÇÃO DA OBRA","Checklist de entrega","Faça a conferência junto com o cliente e registre o aceite ao terminar.")}
  <div class="note-box">Esta conferência salva automaticamente neste aparelho. Preencha a obra e o cliente antes de começar; os campos permanecem editáveis.</div>
  <div class="card" style="margin-bottom:13px"><div class="form-grid"><div class="field"><label for="quickWork">Obra / projeto</label><input id="quickWork" data-quick-field="work" placeholder="Identificação da obra" value="${esc(q.work)}"></div><div class="field"><label for="quickClient">Cliente</label><input id="quickClient" data-quick-field="client" placeholder="Nome do cliente" value="${esc(q.client)}"></div><div class="field full"><label for="quickAddress">Endereço do serviço</label><input id="quickAddress" data-quick-field="address" placeholder="Endereço da obra" value="${esc(q.address)}"></div></div></div>
  <div class="card"><div class="section-head"><h2>Conferência com o cliente</h2><span class="badge gray">${Object.values(q.checks).filter(Boolean).length} de ${QUICK_CHECKLIST.flatMap(x=>x[1]).length}</span></div>
  ${QUICK_CHECKLIST.map(([section,items])=>`<div class="checklist-section"><h3>${section}</h3>${items.map((label,i)=>{const key=`${section}-${i}`;return `<label class="check-item"><input type="checkbox" data-quick-check="${esc(key)}" ${q.checks[key]?"checked":""}><span>${esc(label)}</span></label>`}).join("")}</div>`).join("")}
  <div class="field" style="margin-top:14px"><label for="quickNotes">Observações ou pendências</label><textarea id="quickNotes" data-quick-field="notes" placeholder="Descreva algum ajuste que ficou pendente, se houver.">${esc(q.notes||"")}</textarea></div>
  <div class="signature-box"><p>Peça ao cliente para assinar na tela após conferir os itens. A assinatura e as marcações ficam salvas somente neste aparelho.</p><div class="field"><label for="quickSigner">Nome do cliente</label><input id="quickSigner" data-quick-field="signer" placeholder="Nome de quem acompanhou a conferência" value="${esc(q.signer)}"></div><canvas id="quickSignature" class="signature-canvas" aria-label="Campo para assinatura do cliente"></canvas><div class="signature-row" style="justify-content:space-between;margin-top:8px"><span class="project-sub">Assinatura do cliente</span><button class="btn small" data-action="clear-quick-signature">Limpar assinatura</button></div><div class="actions" style="margin-top:14px"><button class="btn primary" data-action="complete-quick">Registrar obra concluída</button></div>${q.completedAt?`<div class="project-sub" style="margin-top:11px">Finalização registrada em ${dateBR(q.completedAt)} · ${esc(q.signer)}</div>`:""}</div></div>
  <p class="disclaimer">A assinatura capturada aqui é um registro de aceite no aparelho. Para validade e armazenamento formal, será necessária integração de assinatura eletrônica.</p>`;
}
function renderFinance(){
 const entries=state.transactions.filter(t=>t.type==="entrada").reduce((s,t)=>s+Number(t.amount||0),0),outs=state.transactions.filter(t=>t.type==="saída").reduce((s,t)=>s+Number(t.amount||0),0);
 return `${pageHead("CONTROLE POR OBRA","Financeiro","Registre cada entrada e cada saída vinculada ao projeto correspondente.",`<button class="btn primary" data-action="new-transaction">＋ Lançar movimentação</button>`)}
 <div class="finance-summary"><div class="finance-tile in"><span>Entradas</span><strong>${money(entries)}</strong></div><div class="finance-tile out"><span>Saídas</span><strong>${money(outs)}</strong></div><div class="finance-tile net"><span>Saldo registrado</span><strong>${money(entries-outs)}</strong></div></div>
  <div class="card" style="margin-bottom:14px"><div class="section-head"><h2>Resultado por projeto</h2><span class="metric-sub">Entradas lançadas menos despesas lançadas</span></div><div class="table-wrap"><table style="min-width:660px"><thead><tr><th>Projeto / cliente</th><th>Valor contratado</th><th>Entradas</th><th>Saídas</th><th>Saldo registrado</th></tr></thead><tbody>${state.projects.length?state.projects.map(p=>{const tx=state.transactions.filter(t=>t.projectId===p.id),inc=tx.filter(t=>t.type==="entrada").reduce((s,t)=>s+Number(t.amount||0),0),out=tx.filter(t=>t.type==="saída").reduce((s,t)=>s+Number(t.amount||0),0);return `<tr><td><strong>${esc(p.name)}</strong><div class="project-sub">${esc(clientName(p.clientId))}</div></td><td>${money(p.value)}</td><td style="color:#438263">${money(inc)}</td><td style="color:#b26358">${money(out)}</td><td style="font-weight:700">${money(inc-out)}</td></tr>`}).join(""):`<tr><td colspan="5"><div class="empty-state"><b>Nenhum projeto cadastrado</b>O resultado aparecerá depois que houver projetos e lançamentos.</div></td></tr>`}</tbody></table></div></div>
  <div class="toolbar"><select class="filter" id="financeProject"><option value="todos">Todos os projetos</option>${state.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select><select class="filter" id="financeType"><option value="todos">Entradas e saídas</option><option value="entrada">Entradas</option><option value="saída">Saídas</option></select><span class="grow"></span><span class="metric-sub">${state.transactions.length} lançamentos</span></div>
  <div class="card table-card"><div class="table-wrap"><table style="min-width:730px"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Projeto</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>${state.transactions.length?state.transactions.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(t=>`<tr data-row-project="${t.projectId}" data-row-type="${t.type}"><td>${dateBR(t.date)}</td><td><strong>${esc(t.description)}</strong></td><td>${esc(t.category)}</td><td>${esc(projectLabel(t.projectId))}</td><td><span class="badge ${t.type==="entrada"?"green":"amber"}">${t.type=== "entrada"?"Entrada":"Saída"}</span></td><td style="font-weight:700;color:${t.type==="entrada"?"#438263":"#b26358"}">${t.type==="entrada"?"+":"−"} ${money(t.amount)}</td></tr>`).join(""):`<tr><td colspan="6"><div class="empty-state"><b>Nenhuma movimentação registrada</b>Cadastre entradas e custos para visualizar o saldo de cada projeto.</div></td></tr>`}</tbody></table></div></div><p class="disclaimer">Para obter o resultado de uma obra, vincule todos os lançamentos ao projeto. O saldo mostrado não considera custos ou encargos que ainda não foram lançados.</p>`;
}

function bindViewEvents(){
 document.querySelectorAll("[data-view]").forEach(el=>{if(el.dataset.boundView)return;el.dataset.boundView="true";el.addEventListener("click",()=>{currentView=el.dataset.view;selectedAssembly=null;document.getElementById("sidebar").classList.remove("open");render();});});
 document.querySelectorAll("[data-action]").forEach(el=>el.addEventListener("click",()=>action(el.dataset.action,el.dataset.id)));
 const ps=document.getElementById("projectSearch");if(ps)ps.addEventListener("input",()=>{const at=ps.selectionStart;render();const inp=document.getElementById("projectSearch");inp?.focus();inp?.setSelectionRange(at,at);});
 const cs=document.getElementById("clientSearch");if(cs)cs.addEventListener("input",()=>{const at=cs.selectionStart;render();const inp=document.getElementById("clientSearch");inp?.focus();inp?.setSelectionRange(at,at);});
 document.getElementById("projectFilter")?.addEventListener("change",e=>document.querySelectorAll("tbody tr[data-stage]").forEach(row=>row.hidden=e.target.value!=="todos"&&row.dataset.stage!==e.target.value));
 document.getElementById("financeProject")?.addEventListener("change",filterFinance);document.getElementById("financeType")?.addEventListener("change",filterFinance);
 document.querySelectorAll("[data-check]").forEach(input=>input.addEventListener("change",()=>{const p=state.projects.find(x=>x.id===selectedAssembly);if(!p)return;p.checks=p.checks||{};p.checks[input.dataset.check]=input.checked;save();}));
 document.querySelectorAll("[data-quick-check]").forEach(input=>input.addEventListener("change",()=>{const q=quickChecklistState();q.checks[input.dataset.quickCheck]=input.checked;save();render();}));
 document.querySelectorAll("[data-quick-field]").forEach(input=>input.addEventListener("change",()=>{quickChecklistState()[input.dataset.quickField]=input.value;save();}));
 if(document.getElementById("quickSignature"))setupQuickSignature();
}
function filterFinance(){const p=document.getElementById("financeProject").value,t=document.getElementById("financeType").value;document.querySelectorAll("tbody tr[data-row-project]").forEach(row=>row.hidden=(p!=="todos"&&row.dataset.rowProject!==p)||(t!=="todos"&&row.dataset.rowType!==t));}
function action(name,id){
 if(name==="new-client")return openClientModal();if(name==="new-project")return openProjectModal();if(name==="new-transaction")return openTransactionModal();
 if(name==="invite-info")return openInfoModal();
 if(name==="complete-quick")return completeQuickChecklist();
 if(name==="clear-quick-signature"){const q=quickChecklistState();q.signatureData="";save();render();return;}
 if(name==="project-detail")return openProjectDetail(id);if(name==="project-environments")return openEnvironmentModal(id);
 if(name==="client-detail")return openClientDetail(id);
 if(name==="advance-stage"){const p=state.projects.find(x=>x.id===id);if(!p)return;const next=STAGES[Math.min(STAGES.indexOf(p.stage||STAGES[0])+1,STAGES.length-1)];if(next===STAGES[STAGES.length-1]){currentView="assembly";selectedAssembly=id;render();showToast("Abra e conclua o checklist com o cliente.");return;}p.stage=next;save();render();showToast(`Projeto avançou para ${next}.`);return;}
 if(name==="select-assembly"){selectedAssembly=id;render();return;}
 if(name==="complete-assembly")return completeAssembly(id);
}
function modal(title,subtitle,body,footer=""){
 document.getElementById("modalRoot").innerHTML=`<div class="modal-backdrop" data-close="true"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="close" data-close="true" aria-label="Fechar">×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-foot">${footer}</div>`:""}</section></div>`;
 document.querySelectorAll("[data-close]").forEach(e=>e.addEventListener("click",ev=>{if(ev.target===e||e.classList.contains("close"))closeModal();}));
 document.querySelector(".modal")?.addEventListener("click",e=>e.stopPropagation());
}
function closeModal(){document.getElementById("modalRoot").innerHTML="";}
function field(label,name,placeholder="",type="text",required=false,value=""){return `<div class="field"><label for="${name}">${label}${required?" *":""}</label><input id="${name}" name="${name}" type="${type}" placeholder="${placeholder}" ${required?"required":""} value="${esc(value)}"></div>`;}
function openClientModal(){
 modal("Novo cliente","Cadastre as informações básicas do contratante.",`<div class="form-grid">${field("Nome completo","clientName","Nome do cliente","text",true)}${field("Telefone / WhatsApp","clientPhone","(00) 00000-0000","tel")}${field("E-mail","clientEmail","cliente@email.com","email")}${field("Endereço da obra","clientAddress","Rua, número, bairro e cidade","text")}</div><p class="disclaimer">Não solicite dados pessoais que não sejam necessários ao atendimento. Os dados digitados ficam neste navegador.</p>`,`<button class="btn" data-close="true">Cancelar</button><button class="btn primary" id="saveClient">Salvar cliente</button>`);
 document.getElementById("saveClient").onclick=()=>{const name=document.getElementById("clientName").value.trim();if(!name)return showToast("Informe o nome do cliente.");state.clients.push({id:crypto.randomUUID(),name,phone:document.getElementById("clientPhone").value.trim(),email:document.getElementById("clientEmail").value.trim(),address:document.getElementById("clientAddress").value.trim()});save();closeModal();render();showToast("Cliente cadastrado.");};
}
function openProjectModal(){
 const clientOptions=state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 modal("Cadastrar projeto","Registre a obra fechada para iniciar o acompanhamento.",`${!state.clients.length?`<div class="note-box">Cadastre o cliente primeiro. O projeto precisa estar vinculado a um cliente para organizar documentos e movimentações.</div>`:""}<div class="form-grid">${field("Nome do projeto / obra","projectName","Ex.: Marcenaria residência Silva","text",true)}<div class="field"><label for="projectClient">Cliente *</label><select id="projectClient" required><option value="">Selecione o cliente</option>${clientOptions}</select></div>${field("Valor contratado","projectValue","R$ 0,00","number",true)}${field("Previsão / próximo marco","projectMilestone","Ex.: medição da cozinha","text")}${field("Ambientes previstos","projectEnvironment","Ex.: cozinha, quarto, sala","text")}${field("Data prevista","projectDue","","date")}</div><div class="field" style="margin-top:12px"><label for="projectContract">Situação do contrato</label><select id="projectContract"><option>A preparar</option><option>Enviado para assinatura</option><option>Assinado</option></select></div>`,`<button class="btn" data-close="true">Cancelar</button><button class="btn primary" id="saveProject" ${state.clients.length?"":"disabled"}>Criar projeto</button>`);
 document.getElementById("saveProject").onclick=()=>{const name=document.getElementById("projectName").value.trim(),clientId=document.getElementById("projectClient").value,value=Number(document.getElementById("projectValue").value);if(!name||!clientId||!value)return showToast("Preencha nome, cliente e valor contratado.");const p={id:crypto.randomUUID(),name,clientId,value,milestone:document.getElementById("projectMilestone").value.trim()||"A definir",environment:document.getElementById("projectEnvironment").value.trim(),due:document.getElementById("projectDue").value,contract:document.getElementById("projectContract").value,stage:STAGES[0],checks:{},createdAt:todayISO()};state.projects.push(p);save();closeModal();currentView="projects";render();showToast("Projeto cadastrado como Projeto fechado.");};
}
function openTransactionModal(){
 const opts=state.projects.map(p=>`<option value="${p.id}">${esc(p.name)} — ${esc(clientName(p.clientId))}</option>`).join("");
 const categories=["Pagamento do cliente","Diária de mão de obra","Escritório","Gasolina / deslocamento","Material","Frete","Outro"];
 modal("Lançar movimentação","Vincule o valor ao projeto que recebeu a entrada ou gerou o custo.",`${!state.projects.length?`<div class="note-box">Cadastre um projeto antes de lançar uma movimentação.</div>`:""}<div class="form-grid"><div class="field"><label for="txType">Tipo *</label><select id="txType"><option value="entrada">Entrada</option><option value="saída">Saída</option></select></div><div class="field"><label for="txProject">Projeto *</label><select id="txProject"><option value="">Selecione o projeto</option>${opts}</select></div><div class="field"><label for="txCategory">Categoria</label><select id="txCategory">${categories.map(c=>`<option>${c}</option>`).join("")}</select></div>${field("Valor (R$)","txAmount","0,00","number",true)}${field("Data","txDate","","date",true,todayISO())}<div class="field"><label for="txDescription">Descrição *</label><input id="txDescription" placeholder="Ex.: diária do marceneiro"></div></div>`,`<button class="btn" data-close="true">Cancelar</button><button class="btn primary" id="saveTransaction" ${state.projects.length?"":"disabled"}>Salvar lançamento</button>`);
 document.getElementById("saveTransaction").onclick=()=>{const projectId=document.getElementById("txProject").value,amount=Number(document.getElementById("txAmount").value),description=document.getElementById("txDescription").value.trim();if(!projectId||amount<=0||!description)return showToast("Preencha projeto, descrição e valor.");state.transactions.push({id:crypto.randomUUID(),type:document.getElementById("txType").value,projectId,category:document.getElementById("txCategory").value,amount,date:document.getElementById("txDate").value,description});save();closeModal();render();showToast("Movimentação registrada no projeto.");};
}
function openInfoModal(){modal("Cadastro do cliente por link","O fluxo está previsto; falta ativar o banco de dados compartilhado.",`<div class="note-box">Um link enviado ao cliente precisa gravar a resposta em um banco acessível pela equipe. O protótipo atual guarda dados somente no navegador e não deve ser usado para coletar dados de clientes por link.</div><div class="detail-grid"><div class="detail-tile"><label>PRÓXIMA IMPLEMENTAÇÃO</label><strong>Formulário público com link individual</strong></div><div class="detail-tile"><label>DESTINO DO CADASTRO</label><strong>Cliente, obra, contrato e montagem</strong></div></div><p class="disclaimer">A criação de links reais exige API/banco de dados, validação e regras de acesso. Nenhum convite foi enviado.</p>`,`<button class="btn primary" data-close="true">Entendi</button>`);}
function openProjectDetail(id){const p=state.projects.find(x=>x.id===id);if(!p)return;const tx=state.transactions.filter(t=>t.projectId===id),inc=tx.filter(t=>t.type==="entrada").reduce((s,t)=>s+Number(t.amount),0),out=tx.filter(t=>t.type==="saída").reduce((s,t)=>s+Number(t.amount),0);modal(esc(p.name),`${esc(clientName(p.clientId))} · ${esc(p.environment||"Ambientes a definir")}`,`<div class="detail-grid"><div class="detail-tile"><label>VALOR CONTRATADO</label><strong>${money(p.value)}</strong></div><div class="detail-tile"><label>CONTRATO</label><strong>${esc(p.contract||"A preparar")}</strong></div><div class="detail-tile"><label>ENTRADAS REGISTRADAS</label><strong>${money(inc)}</strong></div><div class="detail-tile"><label>SAÍDAS REGISTRADAS</label><strong>${money(out)}</strong></div></div><div class="section-head" style="margin-top:18px"><h2>Etapas do projeto</h2><span class="badge ${statusTone(p.stage)}">${esc(p.stage)}</span></div><div class="timeline">${STAGES.map((s,i)=>{const current=STAGES.indexOf(p.stage);return `<div class="timeline-row ${i<current?"done":i===current?"current":""}"><span class="timeline-marker">${i<current?"✓":i+1}</span><div><b>${s}</b><small>${i<current?"Concluída":i===current?"Em andamento":"Pendente"}</small></div></div>`}).join("")}</div><p class="disclaimer">O saldo financeiro usa apenas os lançamentos vinculados. O valor contratado não equivale a entrada recebida nem ao lucro da obra.</p>`,`<button class="btn" data-close="true">Fechar</button><button class="btn secondary" data-jump-finance="${id}">Financeiro desta obra</button>`);document.querySelector("[data-jump-finance]")?.addEventListener("click",()=>{closeModal();currentView="finance";render();document.getElementById("financeProject").value=id;filterFinance();});}
function openClientDetail(id){const c=state.clients.find(x=>x.id===id);if(!c)return;const ps=state.projects.filter(p=>p.clientId===id);modal(esc(c.name),"Cadastro de cliente",`<div class="detail-grid"><div class="detail-tile"><label>TELEFONE</label><strong>${esc(c.phone||"Não informado")}</strong></div><div class="detail-tile"><label>E-MAIL</label><strong>${esc(c.email||"Não informado")}</strong></div><div class="detail-tile" style="grid-column:1/-1"><label>ENDEREÇO DA OBRA</label><strong>${esc(c.address||"Não informado")}</strong></div></div><div class="section-head" style="margin-top:18px"><h2>Projetos vinculados</h2></div>${ps.length?ps.map(p=>`<div class="feed-item" style="padding:8px 0"><div class="feed-icon">▦</div><div class="feed-copy"><b>${esc(p.name)}</b><small>${esc(p.stage)} · ${money(p.value)}</small></div></div>`).join(""):`<div class="empty-state">Nenhum projeto vinculado.</div>`}`,`<button class="btn primary" data-close="true">Fechar</button>`);}
function completeAssembly(id){const p=state.projects.find(x=>x.id===id);if(!p)return;const checked=Object.values(p.checks||{}).filter(Boolean).length;const needed=Object.values(CHECKLIST).flat().length;if(checked<needed)return showToast(`Marque os ${needed} itens do checklist antes da conclusão.`);const name=document.getElementById("acceptName").value.trim();if(!name)return showToast("Informe o nome do cliente que acompanhou a conferência.");p.stage="Montagem concluída";p.completedAt=todayISO();p.acceptedBy=name;save();render();showToast("Conclusão registrada. Consulte a observação sobre assinatura formal.");}

document.getElementById("menuToggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
render();
function openEnvironmentModal(id){
 const p=state.projects.find(x=>x.id===id);if(!p)return;
 const statuses=["Não liberado","Liberado para medição","Medido","Em produção","Pronto para montagem","Montagem concluída"];
 if(!p.envs)p.envs=(p.environment||"").split(",").map(name=>name.trim()).filter(Boolean).map(name=>({name,status:statuses[0]}));
 const environments=p.envs;
 modal("Liberação por ambiente",`${esc(p.name)} · ${esc(clientName(p.clientId))}`,`${environments.length?environments.map((env,i)=>`<div class="detail-tile" style="margin-bottom:8px"><label>AMBIENTE ${String(i+1).padStart(2,"0")}</label><strong>${esc(env.name)}</strong><div class="field" style="margin-top:9px"><label for="envStatus${i}">Situação</label><select id="envStatus${i}" data-env-status="${i}">${statuses.map(s=>`<option ${env.status===s?"selected":""}>${s}</option>`).join("")}</select></div></div>`).join(""):`<div class="empty-state"><b>Nenhum ambiente cadastrado</b>Na criação do projeto, informe os ambientes separados por vírgula.</div>`}<p class="disclaimer">A liberação de um ambiente é independente das demais. Os registros são salvos neste navegador.</p>`,`<button class="btn primary" data-close="true">Fechar</button>`);
 document.querySelectorAll("[data-env-status]").forEach(sel=>sel.addEventListener("change",()=>{p.envs[Number(sel.dataset.envStatus)].status=sel.value;save();showToast("Situação do ambiente atualizada.");}));
 save();
}
function setupQuickSignature(){
 const canvas=document.getElementById("quickSignature");if(!canvas)return;
 const ratio=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect();
 canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.round(130*ratio);
 const ctx=canvas.getContext("2d");ctx.scale(ratio,ratio);ctx.lineWidth=2.2;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#173d35";
 const q=quickChecklistState();
 if(q.signatureData){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,rect.width,130);img.src=q.signatureData;}
 let drawing=false;
 const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
 canvas.addEventListener("pointerdown",e=>{e.preventDefault();drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});
 canvas.addEventListener("pointermove",e=>{if(!drawing)return;e.preventDefault();const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();});
 const finish=()=>{if(!drawing)return;drawing=false;q.signatureData=canvas.toDataURL("image/png");save();};
 canvas.addEventListener("pointerup",finish);canvas.addEventListener("pointercancel",finish);
}
function completeQuickChecklist(){
 const q=quickChecklistState();
 for(const input of document.querySelectorAll("[data-quick-field]"))q[input.dataset.quickField]=input.value;
 const required=QUICK_CHECKLIST.flatMap(x=>x[1]).length,done=Object.values(q.checks).filter(Boolean).length;
 if(done<required)return showToast(`Marque todos os ${required} itens conferidos para concluir.`);
 if(!q.work.trim())return showToast("Informe a obra ou o projeto.");
 if(!q.signer.trim())return showToast("Informe o nome do cliente.");
 if(!q.signatureData)return showToast("Peça ao cliente para assinar no campo acima.");
 q.completedAt=todayISO();save();render();showToast("Checklist de finalização registrado neste aparelho.");
}
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("service-worker.js").catch(()=>{});
