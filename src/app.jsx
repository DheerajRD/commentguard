import { useState } from "react";

const SEV = {
  toxic:    { label:"Toxic",    color:"#f43f5e", bg:"rgba(244,63,94,0.1)",    icon:"☠️",  rank:0 },
  negative: { label:"Negative", color:"#fb923c", bg:"rgba(251,146,60,0.1)",   icon:"👎",  rank:1 },
  spam:     { label:"Spam",     color:"#a78bfa", bg:"rgba(167,139,250,0.1)",  icon:"🚫",  rank:2 },
  neutral:  { label:"Neutral",  color:"#64748b", bg:"rgba(100,116,139,0.08)", icon:"💬",  rank:3 },
  positive: { label:"Positive", color:"#34d399", bg:"rgba(52,211,153,0.1)",   icon:"✅",  rank:4 },
};

export default function App() {
  const [apifyToken, setApifyToken] = useState("");
  const [tokenSaved, setTokenSaved] = useState(false);
  const [postUrl,    setPostUrl]    = useState("");
  const [platform,   setPlatform]   = useState("instagram");
  const [maxComments,setMaxComments]= useState(100);
  const [stage,      setStage]      = useState("idle");
  const [stageMsg,   setStageMsg]   = useState("");
  const [progress,   setProgress]   = useState(0);
  const [errorMsg,   setErrorMsg]   = useState("");
  const [comments,   setComments]   = useState([]);
  const [stats,      setStats]      = useState(null);
  const [postMeta,   setPostMeta]   = useState(null);
  const [filter,     setFilter]     = useState("flagged");
  const [autoHide,   setAutoHide]   = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const handleRun = async () => {
    if (!apifyToken.trim()) { setErrorMsg("Please enter and save your Apify API token."); return; }
    if (!postUrl.trim())    { setErrorMsg("Please paste a post URL."); return; }
    const urlOk = postUrl.includes("instagram.com") || postUrl.includes("twitter.com") || postUrl.includes("x.com");
    if (!urlOk) { setErrorMsg("URL must be from instagram.com, twitter.com, or x.com"); return; }
    setErrorMsg(""); setComments([]); setStats(null);
    try {
      setStage("scraping");
      setStageMsg(`Fetching up to ${maxComments} comments via Apify…`);
      setProgress(10);
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postUrl: postUrl.trim(), apifyToken: apifyToken.trim(), maxComments }),
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeRes.ok) throw new Error(scrapeData.error || "Scraping failed");
      const rawComments = scrapeData.comments;
      if (!rawComments?.length) throw new Error("No comments found. Is the post public?");
      setProgress(50);
      setPostMeta({ url: postUrl.trim(), count: rawComments.length });
      setStage("analysing");
      setStageMsg(`Analysing ${rawComments.length} comments with Claude AI…`);
      setProgress(60);
      const analyseRes = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: rawComments }),
      });
      const analyseData = await analyseRes.json();
      if (!analyseRes.ok) throw new Error(analyseData.error || "Analysis failed");
      setProgress(92);
      const enriched = rawComments
        .map(c => {
          const r = analyseData.results?.find(x => x.id === c.id) || { severity:"neutral", reason:"" };
          return { ...c, severity: r.severity, reason: r.reason };
        })
        .sort((a,b) => (SEV[a.severity]?.rank ?? 5) - (SEV[b.severity]?.rank ?? 5));
      const counts = { toxic:0, negative:0, spam:0, neutral:0, positive:0 };
      enriched.forEach(c => { if (counts[c.severity] !== undefined) counts[c.severity]++; });
      setStats({ total: enriched.length, counts });
      setComments(enriched);
      setProgress(100);
      setStage("done");
    } catch (e) {
      setErrorMsg(e.message || "Something went wrong.");
      setStage("error");
      setProgress(0);
    }
  };

  const flaggedCount = comments.filter(c => ["toxic","negative","spam"].includes(c.severity)).length;
  const filtered = filter === "all" ? comments
    : filter === "flagged" ? comments.filter(c => ["toxic","negative","spam"].includes(c.severity))
    : comments.filter(c => c.severity === filter);
  const visible = autoHide ? comments.filter(c => ["positive","neutral"].includes(c.severity)) : filtered;
  const isRunning = stage === "scraping" || stage === "analysing";

  return (
    <div style={{ minHeight:"100vh", background:"#07070f", color:"#e0e0f0", fontFamily:"'Outfit','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Mono:wght@700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0d0d1a}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:4px}
        .btn{cursor:pointer;border:none;transition:all .15s ease}
        .btn:hover{filter:brightness(1.12);transform:translateY(-1px)}
        .btn:active{transform:translateY(0)}
        .fade{animation:fadeUp .35s ease}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .card-row{transition:transform .15s ease}
        .card-row:hover{transform:translateX(3px)}
        .prog{transition:width .5s ease}
        input{outline:none;transition:border-color .2s}
        input:focus{border-color:#6366f1 !important}
        .pulse{animation:pulse 2s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
      `}</style>

      <nav style={{ background:"#0c0c1a", borderBottom:"1px solid #15152a", padding:"14px 28px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#6366f1,#ec4899)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>🛡️</div>
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize:15, fontWeight:700, letterSpacing:"-0.5px" }}>
          CommentGuard <span style={{ color:"#6366f1" }}>AI</span>
        </span>
        {stage === "done" && (
          <span style={{ marginLeft:"auto", fontSize:12, color:"#34d399", fontWeight:600 }}>
            ✅ {comments.length} analysed · 🚨 {flaggedCount} flagged
          </span>
        )}
      </nav>

      <div style={{ maxWidth:740, margin:"0 auto", padding:"32px 20px 60px" }}>
        <div style={{ background:"#0e0e1e", border:"1px solid #1a1a2e", borderRadius:18, padding:"28px", marginBottom:22 }}>

          <StepLabel num="1" color="#6366f1" text="Your Apify API Token" />
          <div style={{ display:"flex", gap:8, marginBottom:6 }}>
            <input type="password" value={apifyToken}
              onChange={e => { setApifyToken(e.target.value); setTokenSaved(false); }}
              placeholder="apify_api_xxxxxxxxxxxxxxxxxxxxxxxx"
              style={{ flex:1, background:"#0a0a18", border:`1px solid ${tokenSaved ? "#34d399" : "#1e1e30"}`, borderRadius:10, padding:"11px 14px", color:"#e0e0f0", fontSize:14, fontFamily:"monospace" }} />
            <button className="btn" onClick={() => { if (apifyToken.trim()) setTokenSaved(true); }}
              style={{ padding:"0 18px", borderRadius:10, fontSize:13, fontWeight:700, background: apifyToken.trim() ? "linear-gradient(135deg,#6366f1,#a855f7)" : "#1a1a2e", color: apifyToken.trim() ? "#fff" : "#444" }}>
              {tokenSaved ? "✅ Saved" : "Save"}
            </button>
          </div>
          <p style={{ fontSize:12, color:"#333", marginBottom:22 }}>
            Get free token → <a href="https://apify.com" target="_blank" rel="noreferrer" style={{ color:"#6366f1", textDecoration:"none" }}>apify.com</a> → Settings → API & Integrations
          </p>

          <Divider />

          <StepLabel num="2" color="#e1306c" text="Choose Platform" />
          <div style={{ display:"flex", gap:8, marginBottom:22 }}>
            {[{key:"instagram",icon:"📸",label:"Instagram"},{key:"twitter",icon:"🐦",label:"X / Twitter"}].map(p => (
              <button key={p.key} className="btn" onClick={() => setPlatform(p.key)}
                style={{ flex:1, padding:"11px", borderRadius:10, fontSize:13, fontWeight:700,
                  background: platform===p.key ? (p.key==="instagram" ? "linear-gradient(135deg,#f09433,#e1306c)" : "linear-gradient(135deg,#1d9bf0,#0d8bd9)") : "#111120",
                  color: platform===p.key ? "#fff" : "#555", border:"1px solid #1a1a2e" }}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          <StepLabel num="3" color="#fb923c" text="Paste Post URL" />
          <input value={postUrl} onChange={e => setPostUrl(e.target.value)}
            placeholder={platform==="instagram" ? "https://www.instagram.com/p/ABC123xyz/" : "https://x.com/username/status/123456789"}
            style={{ width:"100%", background:"#0a0a18", border:"1px solid #1e1e30", borderRadius:10, padding:"12px 14px", color:"#e0e0f0", fontSize:14, marginBottom:6 }} />
          <p style={{ fontSize:12, color:"#333", marginBottom:22 }}>Must be a public post or reel</p>

          <Divider />

          <StepLabel num="4" color="#a78bfa" text="How many comments to scan?" />
          <div style={{ display:"flex", gap:8, marginBottom:22 }}>
            {[50,100,250,500].map(n => (
              <button key={n} className="btn" onClick={() => setMaxComments(n)}
                style={{ flex:1, padding:"10px 0", borderRadius:10, fontSize:13, fontWeight:700,
                  background: maxComments===n ? "linear-gradient(135deg,#a78bfa,#6366f1)" : "#111120",
                  color: maxComments===n ? "#fff" : "#555", border:"1px solid #1a1a2e" }}>
                {n}{n===500?" 🔥":""}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div style={{ background:"rgba(244,63,94,0.1)", border:"1px solid rgba(244,63,94,0.3)", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#f43f5e" }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <button className="btn" onClick={handleRun} disabled={isRunning}
            style={{ width:"100%", padding:"15px", borderRadius:12, fontSize:15, fontWeight:800,
              background: isRunning ? "#1a1a2e" : "linear-gradient(135deg,#6366f1,#ec4899)",
              color: isRunning ? "#444" : "#fff",
              boxShadow: isRunning ? "none" : "0 4px 28px rgba(99,102,241,.4)",
              cursor: isRunning ? "not-allowed" : "pointer" }}>
            {stage==="scraping" ? "📡 Scraping comments…" : stage==="analysing" ? "🤖 Claude is analysing…" : stage==="done" ? "🔄 Analyse Another Post" : "🚀 Fetch & Analyse Comments"}
          </button>
        </div>

        {isRunning && (
          <div className="fade" style={{ background:"#0e0e1e", border:"1px solid #1a1a2e", borderRadius:16, padding:"28px", textAlign:"center", marginBottom:22 }}>
            <div className="pulse" style={{ fontSize:44, marginBottom:12 }}>{stage==="scraping" ? "📡" : "🤖"}</div>
            <p style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>{stage==="scraping" ? "Scraping comments from "+platform+"…" : "Claude AI is analysing…"}</p>
            <p style={{ fontSize:13, color:"#555", marginBottom:20 }}>{stageMsg}</p>
            <div style={{ background:"#1a1a2e", borderRadius:100, height:8, overflow:"hidden", maxWidth:380, margin:"0 auto" }}>
              <div className="prog" style={{ height:"100%", borderRadius:100, background:"linear-gradient(90deg,#6366f1,#ec4899)", width:`${progress}%` }} />
            </div>
            <p style={{ fontSize:12, color:"#333", marginTop:8 }}>{progress}%</p>
          </div>
        )}

        {stage==="done" && comments.length > 0 && (
          <div className="fade">
            <div style={{ background:"#0e0e1e", border:"1px solid #1a1a2e", borderRadius:12, padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:22 }}>{platform==="instagram" ? "📸" : "🐦"}</span>
              <div style={{ flex:1, minWidth:180 }}>
                <p style={{ fontSize:11, color:"#444", marginBottom:2 }}>Analysed post</p>
                <a href={postMeta?.url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#6366f1", textDecoration:"none", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{postMeta?.url}</a>
              </div>
              <span style={{ fontSize:12, color:"#555" }}>{postMeta?.count} comments fetched</span>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:18 }}>
              {Object.entries(SEV).map(([key,cfg]) => (
                <div key={key} style={{ background:cfg.bg, border:`1px solid ${cfg.color}25`, borderRadius:12, padding:"14px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{cfg.icon}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:cfg.color, fontFamily:"'Space Mono',monospace" }}>{stats?.counts[key]??0}</div>
                  <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{cfg.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
              {[{key:"flagged",label:`🚨 Flagged (${flaggedCount})`},{key:"all",label:"📋 All"},{key:"toxic",label:"☠️ Toxic"},{key:"negative",label:"👎 Negative"},{key:"spam",label:"🚫 Spam"},{key:"positive",label:"✅ Positive"}].map(f => (
                <button key={f.key} className="btn" onClick={() => { setFilter(f.key); setAutoHide(false); }}
                  style={{ padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:600,
                    background: filter===f.key && !autoHide ? "linear-gradient(135deg,#6366f1,#a855f7)" : "#111120",
                    color: filter===f.key && !autoHide ? "#fff" : "#555", border:"1px solid #1a1a2e" }}>{f.label}</button>
              ))}
              <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, color:"#444" }}>Clean only</span>
                <div onClick={() => setAutoHide(v => !v)} style={{ cursor:"pointer", width:38, height:20, borderRadius:100, background:autoHide?"#6366f1":"#1a1a2e", position:"relative", transition:"background .2s", flexShrink:0 }}>
                  <div style={{ position:"absolute", top:2, left:autoHide?20:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
                </div>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {visible.length === 0
                ? <div style={{ textAlign:"center", padding:48, color:"#333", fontSize:14 }}>No comments match this filter.</div>
                : visible.map(c => {
                    const cfg = SEV[c.severity] || SEV.neutral;
                    const open = expandedId === c.id;
                    return (
                      <div key={c.id} className="card-row" onClick={() => setExpandedId(open ? null : c.id)}
                        style={{ background:cfg.bg, border:`1px solid ${cfg.color}22`, borderLeft:`4px solid ${cfg.color}`, borderRadius:12, padding:"14px 16px", cursor:"pointer" }}>
                        <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                          <div style={{ width:36, height:36, borderRadius:"50%", background:`${cfg.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>💬</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                              <span style={{ fontWeight:700, fontSize:13, color:"#ccc" }}>{c.user}</span>
                              <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 9px", borderRadius:100, fontSize:11, fontWeight:700, background:`${cfg.color}18`, color:cfg.color, border:`1px solid ${cfg.color}30` }}>
                                {cfg.icon} {cfg.label}
                              </span>
                              {c.likes > 0 && <span style={{ fontSize:12, color:"#444", marginLeft:"auto" }}>❤️ {c.likes}</span>}
                            </div>
                            <p style={{ fontSize:14, color:"#bbb", lineHeight:1.55 }}>{c.text}</p>
                            {open && c.reason && (
                              <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,.06)" }}>
                                <p style={{ fontSize:12, color:"#777" }}><span style={{ color:cfg.color, fontWeight:700 }}>AI Reason: </span>{c.reason}</p>
                              </div>
                            )}
                          </div>
                          <span style={{ color:"#2a2a3a", fontSize:11, flexShrink:0 }}>{open?"▲":"▼"}</span>
                        </div>
                      </div>
                    );
                  })
              }
            </div>
            <p style={{ textAlign:"center", color:"#1a1a2e", fontSize:11, marginTop:24 }}>
              {visible.length} of {comments.length} shown · CommentGuard AI · Apify + Claude
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepLabel({ num, color, text }) {
  return (
    <label style={{ fontSize:12, fontWeight:700, color:"#777", textTransform:"uppercase", letterSpacing:"0.6px", display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
      <span style={{ background:"#1a1a2e", borderRadius:6, padding:"3px 8px", color, fontFamily:"monospace" }}>{num}</span>
      {text}
    </label>
  );
}

function Divider() {
  return <div style={{ height:1, background:"#12122a", margin:"0 0 22px" }} />;
}
