import { useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const SEV = {
  toxic:    { label:"Toxic",    color:"#f43f5e", bg:"rgba(244,63,94,0.1)",    icon:"☠️", rank:0 },
  negative: { label:"Negative", color:"#fb923c", bg:"rgba(251,146,60,0.1)",   icon:"👎", rank:1 },
  spam:     { label:"Spam",     color:"#a78bfa", bg:"rgba(167,139,250,0.1)",  icon:"🚫", rank:2 },
  neutral:  { label:"Neutral",  color:"#64748b", bg:"rgba(100,116,139,0.08)", icon:"💬", rank:3 },
  positive: { label:"Positive", color:"#34d399", bg:"rgba(52,211,153,0.1)",   icon:"✅", rank:4 },
};

export default function App() {
  const [apifyToken,  setApifyToken]  = useState("");
  const [tokenSaved,  setTokenSaved]  = useState(false);
  const [postUrl,     setPostUrl]     = useState("");
  const [platform,    setPlatform]    = useState("instagram");
  const [maxComments, setMaxComments] = useState(100);
  const [stage,       setStage]       = useState("idle");
  const [stageMsg,    setStageMsg]    = useState("");
  const [progress,    setProgress]    = useState(0);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [comments,    setComments]    = useState([]);
  const [hidden,      setHidden]      = useState(new Set());
  const [deleted,     setDeleted]     = useState(new Set());
  const [reported,    setReported]    = useState(new Set());
  const [stats,       setStats]       = useState(null);
  const [postMeta,    setPostMeta]    = useState(null);
  const [filter,      setFilter]      = useState("flagged");
  const [expandedId,  setExpandedId]  = useState(null);
  const [activeTab,   setActiveTab]   = useState("comments");
  const [toast,       setToast]       = useState(null);

  const showToast = (msg, color="#34d399") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  };

  const handleRun = async () => {
    if (!apifyToken.trim()) { setErrorMsg("Please enter and save your Apify API token."); return; }
    if (!postUrl.trim())    { setErrorMsg("Please paste a post URL."); return; }
    const urlOk = postUrl.includes("instagram.com") || postUrl.includes("twitter.com") || postUrl.includes("x.com");
    if (!urlOk) { setErrorMsg("URL must be from instagram.com, twitter.com, or x.com"); return; }
    setErrorMsg(""); setComments([]); setStats(null);
    setHidden(new Set()); setDeleted(new Set()); setReported(new Set());
    try {
      setStage("scraping"); setStageMsg(`Fetching up to ${maxComments} comments via Apify…`); setProgress(10);
      const scrapeRes  = await fetch("/api/scrape", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ postUrl:postUrl.trim(), apifyToken:apifyToken.trim(), maxComments }),
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) throw new Error(scrapeData.error || "Scraping failed");
      const raw = scrapeData.comments;
      if (!raw?.length) throw new Error("No comments found. Is the post public?");
      setProgress(50);
      setPostMeta({ url:postUrl.trim(), count:raw.length, time:new Date().toLocaleString() });
      setStage("analysing"); setStageMsg(`Analysing ${raw.length} comments with Claude AI…`); setProgress(60);
      const analyseRes  = await fetch("/api/analyse", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ comments:raw }),
      });
      const analyseData = await analyseRes.json();
      if (!analyseRes.ok) throw new Error(analyseData.error || "Analysis failed");
      setProgress(92);
      const enriched = raw
        .map(c => { const r=analyseData.results?.find(x=>x.id===c.id)||{severity:"neutral",reason:""}; return {...c,...r}; })
        .sort((a,b) => (SEV[a.severity]?.rank??5)-(SEV[b.severity]?.rank??5));
      const counts = {toxic:0,negative:0,spam:0,neutral:0,positive:0};
      enriched.forEach(c => { if(counts[c.severity]!==undefined) counts[c.severity]++; });
      setStats({ total:enriched.length, counts });
      setComments(enriched); setProgress(100); setStage("done"); setActiveTab("comments");
    } catch(e) { setErrorMsg(e.message||"Something went wrong."); setStage("error"); setProgress(0); }
  };

  const handleHide   = (e,id) => { e.stopPropagation(); setHidden(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;}); showToast("Comment hidden 👁️","#6366f1"); };
  const handleDelete = (e,id) => { e.stopPropagation(); setDeleted(p=>{const n=new Set(p);n.add(id);return n;}); showToast("Comment deleted 🗑️","#f43f5e"); };
  const handleReport = (e,id) => { e.stopPropagation(); setReported(p=>{const n=new Set(p);n.add(id);return n;}); showToast("Comment reported 🚩","#fb923c"); };

  const flaggedCount = comments.filter(c=>["toxic","negative","spam"].includes(c.severity)).length;
  const visible      = comments.filter(c=>!deleted.has(c.id));
  const filtered     = filter==="all"     ? visible
    : filter==="flagged"  ? visible.filter(c=>["toxic","negative","spam"].includes(c.severity))
    : filter==="hidden"   ? visible.filter(c=>hidden.has(c.id))
    : visible.filter(c=>c.severity===filter);

  const isRunning    = stage==="scraping"||stage==="analysing";
  const pieData      = stats ? Object.entries(SEV).map(([k,v])=>({name:v.label,value:stats.counts[k]||0,color:v.color})).filter(d=>d.value>0) : [];
  const barData      = stats ? Object.entries(SEV).map(([k,v])=>({name:v.label,count:stats.counts[k]||0,fill:v.color})) : [];
  const healthScore  = stats ? Math.round(((stats.counts.positive+stats.counts.neutral*0.5)/stats.total)*100) : 0;

  const generateReport = () => {
    const flagged = comments.filter(c=>["toxic","negative","spam"].includes(c.severity));
    const lines = [
      "╔══════════════════════════════════════╗",
      "║     COMMENTGUARD AI — REPORT         ║",
      "╚══════════════════════════════════════╝",
      `Generated : ${new Date().toLocaleString()}`,
      `Post URL  : ${postMeta?.url}`,
      "",
      "── SUMMARY ─────────────────────────────",
      `Total Comments : ${stats?.total}`,
      `Health Score   : ${healthScore}%`,
      `Toxic          : ${stats?.counts.toxic}`,
      `Negative       : ${stats?.counts.negative}`,
      `Spam           : ${stats?.counts.spam}`,
      `Neutral        : ${stats?.counts.neutral}`,
      `Positive       : ${stats?.counts.positive}`,
      "",
      "── ACTIONS TAKEN ───────────────────────",
      `Deleted  : ${deleted.size}`,
      `Hidden   : ${hidden.size}`,
      `Reported : ${reported.size}`,
      "",
      `── FLAGGED COMMENTS (${flagged.length}) ──────────────`,
      ...flagged.map(c=>`\n[${c.severity.toUpperCase()}] ${c.user}\n"${c.text}"\nReason: ${c.reason}`),
    ];
    const blob = new Blob([lines.join("\n")], {type:"text/plain"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download="commentguard-report.txt"; a.click();
    showToast("Report downloaded! 📄","#34d399");
  };

  return (
    <div style={{minHeight:"100vh",background:"#07070f",color:"#e0e0f0",fontFamily:"'Outfit','Segoe UI',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Mono:wght@700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0d0d1a}::-webkit-scrollbar-thumb{background:#222;border-radius:4px}
        .btn{cursor:pointer;border:none;transition:all .15s ease}.btn:hover{filter:brightness(1.12);transform:translateY(-1px)}.btn:active{transform:scale(.97)}
        .fade{animation:fu .35s ease}@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .crow{transition:all .18s ease}.crow:hover{transform:translateX(3px);box-shadow:0 2px 16px rgba(0,0,0,.3)}
        .prog{transition:width .5s ease}input{outline:none}input:focus{border-color:#6366f1!important}
        .pulse{animation:pl 2s ease-in-out infinite}@keyframes pl{0%,100%{opacity:1}50%{opacity:.4}}
        .act-btn{cursor:pointer;border:none;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;transition:all .15s ease}
        .act-btn:hover{transform:scale(1.08)}
      `}</style>

      {toast && (
        <div style={{position:"fixed",top:20,right:20,zIndex:9999,background:toast.color,color:"#fff",
          padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:700,
          boxShadow:"0 4px 20px rgba(0,0,0,.4)",animation:"fu .3s ease"}}>
          {toast.msg}
        </div>
      )}

      <nav style={{background:"#0c0c1a",borderBottom:"1px solid #15152a",padding:"13px 24px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🛡️</div>
        <span style={{fontFamily:"'Space Mono',monospace",fontSize:14,fontWeight:700,letterSpacing:"-0.5px"}}>
          CommentGuard <span style={{color:"#6366f1"}}>AI</span>
        </span>
        {stage==="done" && stats && (
          <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:"#34d399",fontWeight:600}}>✅ {comments.length} analysed</span>
            <span style={{fontSize:12,color:"#f43f5e",fontWeight:600}}>🚨 {flaggedCount} flagged</span>
            <span style={{fontSize:12,color:"#6366f1",fontWeight:600,background:"rgba(99,102,241,.15)",padding:"3px 10px",borderRadius:100}}>
              💚 Health {healthScore}%
            </span>
          </div>
        )}
      </nav>

      <div style={{maxWidth:800,margin:"0 auto",padding:"28px 18px 60px"}}>

        <div style={{background:"#0e0e1e",border:"1px solid #1a1a2e",borderRadius:18,padding:"24px",marginBottom:20}}>
          <SL num="1" color="#6366f1" text="Apify API Token" />
          <div style={{display:"flex",gap:8,marginBottom:6}}>
            <input type="password" value={apifyToken} onChange={e=>{setApifyToken(e.target.value);setTokenSaved(false);}}
              placeholder="apify_api_xxxxxxxxxxxxxxxxxxxxxxxx"
              style={{flex:1,background:"#0a0a18",border:`1px solid ${tokenSaved?"#34d399":"#1e1e30"}`,borderRadius:10,padding:"11px 14px",color:"#e0e0f0",fontSize:14,fontFamily:"monospace"}}/>
            <button className="btn" onClick={()=>{if(apifyToken.trim())setTokenSaved(true);}}
              style={{padding:"0 18px",borderRadius:10,fontSize:13,fontWeight:700,background:apifyToken.trim()?"linear-gradient(135deg,#6366f1,#a855f7)":"#1a1a2e",color:apifyToken.trim()?"#fff":"#444"}}>
              {tokenSaved?"✅ Saved":"Save"}
            </button>
          </div>
          <p style={{fontSize:12,color:"#333",marginBottom:20}}>Get free token → <a href="https://apify.com" target="_blank" rel="noreferrer" style={{color:"#6366f1",textDecoration:"none"}}>apify.com</a> → Settings → API & Integrations</p>
          <div style={{height:1,background:"#12122a",marginBottom:20}}/>
          <SL num="2" color="#e1306c" text="Choose Platform" />
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[{key:"instagram",icon:"📸",label:"Instagram"},{key:"twitter",icon:"🐦",label:"X / Twitter"}].map(p=>(
              <button key={p.key} className="btn" onClick={()=>setPlatform(p.key)}
                style={{flex:1,padding:"11px",borderRadius:10,fontSize:13,fontWeight:700,
                  background:platform===p.key?(p.key==="instagram"?"linear-gradient(135deg,#f09433,#e1306c)":"linear-gradient(135deg,#1d9bf0,#0d8bd9)"):"#111120",
                  color:platform===p.key?"#fff":"#555",border:"1px solid #1a1a2e"}}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>
          <SL num="3" color="#fb923c" text="Paste Post URL" />
          <input value={postUrl} onChange={e=>setPostUrl(e.target.value)}
            placeholder={platform==="instagram"?"https://www.instagram.com/p/ABC123xyz/":"https://x.com/username/status/123456789"}
            style={{width:"100%",background:"#0a0a18",border:"1px solid #1e1e30",borderRadius:10,padding:"12px 14px",color:"#e0e0f0",fontSize:14,marginBottom:6}}/>
          <p style={{fontSize:12,color:"#333",marginBottom:20}}>Must be a public post or reel</p>
          <div style={{height:1,background:"#12122a",marginBottom:20}}/>
          <SL num="4" color="#a78bfa" text="How many comments?" />
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[50,100,250,500].map(n=>(
              <button key={n} className="btn" onClick={()=>setMaxComments(n)}
                style={{flex:1,padding:"10px 0",borderRadius:10,fontSize:13,fontWeight:700,
                  background:maxComments===n?"linear-gradient(135deg,#a78bfa,#6366f1)":"#111120",
                  color:maxComments===n?"#fff":"#555",border:"1px solid #1a1a2e"}}>
                {n}{n===500?" 🔥":""}
              </button>
            ))}
          </div>
          {errorMsg&&<div style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.3)",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13,color:"#f43f5e"}}>⚠️ {errorMsg}</div>}
          <button className="btn" onClick={handleRun} disabled={isRunning}
            style={{width:"100%",padding:"14px",borderRadius:12,fontSize:15,fontWeight:800,
              background:isRunning?"#1a1a2e":"linear-gradient(135deg,#6366f1,#ec4899)",
              color:isRunning?"#444":"#fff",boxShadow:isRunning?"none":"0 4px 28px rgba(99,102,241,.4)",
              cursor:isRunning?"not-allowed":"pointer"}}>
            {stage==="scraping"?"📡 Scraping comments…":stage==="analysing"?"🤖 Claude is analysing…":stage==="done"?"🔄 Analyse Another Post":"🚀 Fetch & Analyse Comments"}
          </button>
        </div>

        {isRunning&&(
          <div className="fade" style={{background:"#0e0e1e",border:"1px solid #1a1a2e",borderRadius:16,padding:"28px",textAlign:"center",marginBottom:20}}>
            <div className="pulse" style={{fontSize:44,marginBottom:12}}>{stage==="scraping"?"📡":"🤖"}</div>
            <p style={{fontWeight:700,fontSize:16,marginBottom:6}}>{stage==="scraping"?"Scraping comments from "+platform+"…":"Claude AI is analysing every comment…"}</p>
            <p style={{fontSize:13,color:"#555",marginBottom:20}}>{stageMsg}</p>
            <div style={{background:"#1a1a2e",borderRadius:100,height:8,overflow:"hidden",maxWidth:380,margin:"0 auto"}}>
              <div className="prog" style={{height:"100%",borderRadius:100,background:"linear-gradient(90deg,#6366f1,#ec4899)",width:`${progress}%`}}/>
            </div>
            <p style={{fontSize:12,color:"#333",marginTop:8}}>{progress}%</p>
          </div>
        )}

        {stage==="done"&&comments.length>0&&(
          <div className="fade">
            <div style={{background:"#0e0e1e",border:"1px solid #1a1a2e",borderRadius:12,padding:"13px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{fontSize:20}}>{platform==="instagram"?"📸":"🐦"}</span>
              <div style={{flex:1,minWidth:180}}>
                <p style={{fontSize:11,color:"#444",marginBottom:2}}>Analysed post</p>
                <a href={postMeta?.url} target="_blank" rel="noreferrer"
                  style={{fontSize:12,color:"#6366f1",textDecoration:"none",display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{postMeta?.url}</a>
              </div>
              <span style={{fontSize:12,color:"#444"}}>{postMeta?.time}</span>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16}}>
              {Object.entries(SEV).map(([k,cfg])=>(
                <div key={k} style={{background:cfg.bg,border:`1px solid ${cfg.color}25`,borderRadius:12,padding:"12px 6px",textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:3}}>{cfg.icon}</div>
                  <div style={{fontSize:20,fontWeight:800,color:cfg.color,fontFamily:"'Space Mono',monospace"}}>{stats?.counts[k]??0}</div>
                  <div style={{fontSize:10,color:"#666",marginTop:2}}>{cfg.label}</div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
              {[{key:"comments",label:"💬 Comments"},{key:"charts",label:"📊 Charts"},{key:"report",label:"📄 Report"}].map(t=>(
                <button key={t.key} className="btn" onClick={()=>setActiveTab(t.key)}
                  style={{padding:"8px 16px",borderRadius:9,fontSize:13,fontWeight:700,
                    background:activeTab===t.key?"linear-gradient(135deg,#6366f1,#a855f7)":"#111120",
                    color:activeTab===t.key?"#fff":"#555",border:"1px solid #1a1a2e"}}>
                  {t.label}
                </button>
              ))}
              <button className="btn" onClick={generateReport}
                style={{marginLeft:"auto",padding:"8px 16px",borderRadius:9,fontSize:13,fontWeight:700,
                  background:"linear-gradient(135deg,#34d399,#059669)",color:"#fff",border:"none"}}>
                📥 Download Report
              </button>
            </div>

            {activeTab==="comments"&&(
              <div className="fade">
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
                  {[
                    {key:"flagged",label:`🚨 Flagged (${flaggedCount})`},
                    {key:"all",label:"📋 All"},
                    {key:"toxic",label:"☠️ Toxic"},
                    {key:"negative",label:"👎 Negative"},
                    {key:"spam",label:"🚫 Spam"},
                    {key:"positive",label:"✅ Positive"},
                    {key:"hidden",label:`👁️ Hidden (${hidden.size})`},
                  ].map(f=>(
                    <button key={f.key} className="btn" onClick={()=>setFilter(f.key)}
                      style={{padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:600,
                        background:filter===f.key?"linear-gradient(135deg,#6366f1,#a855f7)":"#111120",
                        color:filter===f.key?"#fff":"#555",border:"1px solid #1a1a2e"}}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {filtered.length===0
                    ?<div style={{textAlign:"center",padding:48,color:"#333",fontSize:14}}>No comments match this filter.</div>
                    :filtered.map(c=>{
                      const cfg=SEV[c.severity]||SEV.neutral;
                      const open=expandedId===c.id;
                      const isHidden=hidden.has(c.id);
                      return(
                        <div key={c.id} className="crow" onClick={()=>setExpandedId(open?null:c.id)}
                          style={{background:isHidden?"#0a0a14":cfg.bg,border:`1px solid ${isHidden?"#1a1a2e":cfg.color+"22"}`,
                            borderLeft:`4px solid ${isHidden?"#333":cfg.color}`,borderRadius:12,padding:"13px 14px",
                            cursor:"pointer",opacity:isHidden?.6:1}}>
                          <div style={{display:"flex",gap:11,alignItems:"flex-start"}}>
                            <div style={{width:34,height:34,borderRadius:"50%",background:`${cfg.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>💬</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
                                <span style={{fontWeight:700,fontSize:13,color:"#ccc"}}>{c.user}</span>
                                <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:100,fontSize:11,fontWeight:700,background:`${cfg.color}18`,color:cfg.color,border:`1px solid ${cfg.color}30`}}>{cfg.icon} {cfg.label}</span>
                                {isHidden&&<span style={{fontSize:11,color:"#555"}}>👁️ hidden</span>}
                                {reported.has(c.id)&&<span style={{fontSize:11,color:"#fb923c"}}>🚩 reported</span>}
                                {c.likes>0&&<span style={{fontSize:12,color:"#444",marginLeft:"auto"}}>❤️ {c.likes}</span>}
                              </div>
                              <p style={{fontSize:14,color:isHidden?"#555":"#bbb",lineHeight:1.55}}>{c.text}</p>
                              {open&&(
                                <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.06)"}}>
                                  {c.reason&&<p style={{fontSize:12,color:"#777",marginBottom:10}}><span style={{color:cfg.color,fontWeight:700}}>AI Reason: </span>{c.reason}</p>}
                                  <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                                    <button className="act-btn" onClick={e=>handleHide(e,c.id)} style={{background:"rgba(99,102,241,.2)",color:"#6366f1",border:"1px solid rgba(99,102,241,.3)"}}>👁️ {isHidden?"Unhide":"Hide"}</button>
                                    <button className="act-btn" onClick={e=>handleDelete(e,c.id)} style={{background:"rgba(244,63,94,.2)",color:"#f43f5e",border:"1px solid rgba(244,63,94,.3)"}}>🗑️ Delete</button>
                                    <button className="act-btn" onClick={e=>handleReport(e,c.id)} style={{background:"rgba(251,146,60,.2)",color:"#fb923c",border:"1px solid rgba(251,146,60,.3)"}}>🚩 {reported.has(c.id)?"Reported":"Report"}</button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <span style={{color:"#2a2a3a",fontSize:11,flexShrink:0}}>{open?"▲":"▼"}</span>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            )}

            {activeTab==="charts"&&(
              <div className="fade">
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  <div style={{background:"#0e0e1e",border:"1px solid #1a1a2e",borderRadius:14,padding:"20px"}}>
                    <p style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:14}}>📊 Comment Breakdown</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                          {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={{background:"#111",border:"1px solid #222",borderRadius:8,color:"#fff",fontSize:12}}/>
                        <Legend iconType="circle" iconSize={8} formatter={v=><span style={{color:"#888",fontSize:11}}>{v}</span>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{background:"#0e0e1e",border:"1px solid #1a1a2e",borderRadius:14,padding:"20px"}}>
                    <p style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:14}}>📈 Comment Counts</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={barData} barSize={24}>
                        <XAxis dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{background:"#111",border:"1px solid #222",borderRadius:8,color:"#fff",fontSize:12}}/>
                        <Bar dataKey="count" radius={[6,6,0,0]}>{barData.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={{background:"#0e0e1e",border:"1px solid #1a1a2e",borderRadius:14,padding:"20px",marginBottom:12}}>
                  <p style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:14}}>🔍 Key Metrics</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                    {[
                      {label:"Health Score",  value:`${healthScore}%`, color:"#34d399",desc:"overall sentiment"},
                      {label:"Flagged Rate",  value:`${Math.round((flaggedCount/comments.length)*100)}%`, color:"#f43f5e",desc:"need attention"},
                      {label:"Positive Rate", value:`${Math.round((stats.counts.positive/stats.total)*100)}%`, color:"#34d399",desc:"are supportive"},
                      {label:"Spam Rate",     value:`${Math.round((stats.counts.spam/stats.total)*100)}%`, color:"#a78bfa",desc:"are spam/bots"},
                    ].map((s,i)=>(
                      <div key={i} style={{background:`${s.color}0d`,border:`1px solid ${s.color}20`,borderRadius:10,padding:"14px",textAlign:"center"}}>
                        <p style={{fontSize:11,color:"#555",marginBottom:6}}>{s.label}</p>
                        <p style={{fontSize:24,fontWeight:800,color:s.color,fontFamily:"'Space Mono',monospace"}}>{s.value}</p>
                        <p style={{fontSize:11,color:"#444",marginTop:4}}>{s.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{background:"#0e0e1e",border:"1px solid #1a1a2e",borderRadius:14,padding:"20px"}}>
                  <p style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:14}}>💚 Community Health Score</p>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{flex:1,background:"#1a1a2e",borderRadius:100,height:16,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:100,width:`${healthScore}%`,
                        background:healthScore>70?"linear-gradient(90deg,#34d399,#059669)":healthScore>40?"linear-gradient(90deg,#fb923c,#f59e0b)":"linear-gradient(90deg,#f43f5e,#dc2626)",
                        transition:"width 1s ease"}}/>
                    </div>
                    <span style={{fontSize:22,fontWeight:800,color:healthScore>70?"#34d399":healthScore>40?"#fb923c":"#f43f5e",fontFamily:"'Space Mono',monospace",flexShrink:0}}>{healthScore}%</span>
                  </div>
                  <p style={{fontSize:12,color:"#444",marginTop:8}}>
                    {healthScore>70?"✅ Great community! Most comments are positive and supportive."
                    :healthScore>40?"⚠️ Mixed community. Some negativity detected — monitor closely."
                    :"🚨 High toxicity detected! Consider stricter moderation."}
                  </p>
                </div>
              </div>
            )}

            {activeTab==="report"&&(
              <div className="fade">
                <div style={{background:"#0e0e1e",border:"1px solid #1a1a2e",borderRadius:14,padding:"24px"}}>
                  <p style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:16}}>📄 Moderation Report</p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                    <div style={{background:"#0a0a18",borderRadius:10,padding:"12px"}}>
                      <p style={{fontSize:11,color:"#444",marginBottom:4}}>POST URL</p>
                      <p style={{fontSize:12,color:"#6366f1",wordBreak:"break-all"}}>{postMeta?.url}</p>
                    </div>
                    <div style={{background:"#0a0a18",borderRadius:10,padding:"12px"}}>
                      <p style={{fontSize:11,color:"#444",marginBottom:4}}>ANALYSED AT</p>
                      <p style={{fontSize:12,color:"#ccc"}}>{postMeta?.time}</p>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7,marginBottom:16}}>
                    {Object.entries(SEV).map(([k,cfg])=>(
                      <div key={k} style={{background:cfg.bg,border:`1px solid ${cfg.color}25`,borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                        <div style={{fontSize:18,marginBottom:3}}>{cfg.icon}</div>
                        <div style={{fontSize:18,fontWeight:800,color:cfg.color,fontFamily:"'Space Mono',monospace"}}>{stats?.counts[k]??0}</div>
                        <div style={{fontSize:10,color:"#555",marginTop:2}}>{cfg.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:"#0a0a18",borderRadius:10,padding:"13px",marginBottom:16}}>
                    <p style={{fontSize:11,color:"#444",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Actions Taken</p>
                    <div style={{display:"flex",gap:20}}>
                      <span style={{fontSize:13,color:"#f43f5e"}}>🗑️ {deleted.size} deleted</span>
                      <span style={{fontSize:13,color:"#6366f1"}}>👁️ {hidden.size} hidden</span>
                      <span style={{fontSize:13,color:"#fb923c"}}>🚩 {reported.size} reported</span>
                    </div>
                  </div>
                  <p style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Top Flagged Comments</p>
                  <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:20}}>
                    {comments.filter(c=>["toxic","negative"].includes(c.severity)).slice(0,5).map(c=>{
                      const cfg=SEV[c.severity];
                      return(
                        <div key={c.id} style={{background:`${cfg.color}0d`,border:`1px solid ${cfg.color}20`,borderRadius:8,padding:"10px 12px",display:"flex",gap:10,alignItems:"flex-start"}}>
                          <span>{cfg.icon}</span>
                          <div>
                            <span style={{fontSize:12,fontWeight:700,color:cfg.color}}>{c.user} </span>
                            <span style={{fontSize:12,color:"#666"}}>{c.text.slice(0,100)}{c.text.length>100?"…":""}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="btn" onClick={generateReport}
                    style={{width:"100%",padding:"13px",borderRadius:12,fontSize:14,fontWeight:700,
                      background:"linear-gradient(135deg,#6366f1,#ec4899)",color:"#fff",
                      boxShadow:"0 4px 20px rgba(99,102,241,.4)"}}>
                    📥 Download Full Report (.txt)
                  </button>
                </div>
              </div>
            )}
            <p style={{textAlign:"center",color:"#1a1a2e",fontSize:11,marginTop:20}}>CommentGuard AI · {comments.length} comments · Apify + Claude</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SL({num,color,text}){
  return(
    <label style={{fontSize:11,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.6px",display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <span style={{background:"#1a1a2e",borderRadius:6,padding:"3px 8px",color,fontFamily:"monospace"}}>{num}</span>{text}
    </label>
  );
}
