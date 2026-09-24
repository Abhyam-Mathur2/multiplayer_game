import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {supabase} from "./supabase";
import "./styles.css";

const GAME_LIST=[
 {id:"tictactoe",icon:"⭕",title:"Tic Tac Toe",desc:"Classic 3×3 showdown."},
 {id:"rps",icon:"✊",title:"Rock Paper Scissors",desc:"Choose secretly, reveal together."},
 {id:"wouldrather",icon:"🤔",title:"Would You Rather",desc:"Pick without seeing their answer."},
 {id:"whoknows",icon:"👀",title:"Who Knows Who?",desc:"Predict who your partner chooses."}
];

const WR=[
 ["Would you rather have a surprise date every month or plan every date together?","Surprise date","Plan together"],
 ["Would you rather relive your first date or take a dream vacation?","First date","Dream vacation"],
 ["Would you rather cook together or order your favorite food?","Cook together","Order food"],
 ["Would you rather get a handwritten letter or a surprise gift?","Letter","Gift"],
 ["Would you rather spend a rainy day cuddling or go on an adventure?","Cuddle","Adventure"]
];

const WK=[
 "Who is more likely to fall asleep during a movie?",
 "Who is more likely to steal the other person's food?",
 "Who is more likely to plan a surprise?",
 "Who takes longer to get ready?",
 "Who is more likely to laugh at the worst moment?"
];

const uid=()=>crypto.randomUUID();
const code=()=>Math.random().toString(36).slice(2,8).toUpperCase();

function App(){
 const [me,setMe]=useState(()=>localStorage.getItem("duo_id")||uid());
 const [name,setName]=useState(()=>localStorage.getItem("duo_name")||"");
 const [room,setRoom]=useState(null);
 const [mode,setMode]=useState("home");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);

 useEffect(()=>localStorage.setItem("duo_id",me),[me]);
 useEffect(()=>{if(name)localStorage.setItem("duo_name",name)},[name]);

 const createRoom=async(game)=>{
  if(!name.trim()) return setError("Enter your name first.");
  setLoading(true);setError("");
  const c=code();
  const {data,error:e}=await supabase.from("rooms").insert({
   code:c,host_id:me,host_name:name.trim(),game,status:"waiting",
   state:{}
  }).select().single();
  setLoading(false);
  if(e)return setError(e.message);
  setRoom(data);setMode("room");
 };
 const joinRoom=async(c)=>{
  if(!name.trim()) return setError("Enter your name first.");
  setLoading(true);setError("");
  const normalized=c.trim().toUpperCase();
  const {data:r,error:e}=await supabase.from("rooms").select("*").eq("code",normalized).single();
  if(e||!r)return setError("Room not found. Check the code.");
  if(r.guest_id&&r.guest_id!==me)return setError("That room already has two players.");
  if(r.host_id===me){setRoom(r);setMode("room");setLoading(false);return;}
  const {data,error:e2}=await supabase.from("rooms").update({
   guest_id:me,guest_name:name.trim(),status:"playing",state:initialState(r.game)
  }).eq("code",normalized).select().single();
  setLoading(false);if(e2)return setError(e2.message);
  setRoom(error?null:data);setRoom(data);setMode("room");
 };
 const leave=()=>{setRoom(null);setMode("home");setError("")};

 return <div className="app">
  <header><button className="logo" onClick={leave}>💕 <b>DUO</b></button><span>PLAY TOGETHER</span></header>
  {mode==="home"&&<Home name={name} setName={setName} createRoom={createRoom} joinRoom={joinRoom} error={error} loading={loading}/>}
  {mode==="room"&&room&&<Room room={room} me={me} onLeave={leave} setRoom={setRoom}/>}
 </div>
}

function Home({name,setName,createRoom,joinRoom,error,loading}){
 const [join,setJoin]=useState("");
 return <main className="home">
  <section className="hero"><div><span className="eyebrow">💕 ONLINE DATE NIGHT</span><h1>Two phones.<br/><em>One game.</em></h1><p>Create a private room, send the code to your person, and play together in real time.</p></div><div className="hero-card"><span>📱</span><div>YOU</div><strong>♡</strong><div>GF</div><span>📱</span></div></section>
  <section className="setup">
   <label>Your name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Abhyam"/></label>
   <div className="setup-grid">
    <div className="panel"><span className="eyebrow">HOST</span><h2>Create a room</h2><p>Choose a game and send the generated code.</p><div className="game-mini-grid">{GAME_LIST.map(g=><button key={g.id} disabled={loading} onClick={()=>createRoom(g.id)}><span>{g.icon}</span><b>{g.title}</b><small>{g.desc}</small></button>)}</div></div>
    <div className="panel join"><span className="eyebrow">JOIN</span><h2>Have a room code?</h2><p>Enter the six-character code your partner sent you.</p><input className="code-input" value={join} onChange={e=>setJoin(e.target.value.toUpperCase().slice(0,6))} placeholder="ABC123" maxLength="6"/><button className="primary full" disabled={loading||join.length!==6} onClick={()=>joinRoom(join)}>Join room →</button></div>
   </div>
   {error&&<div className="error">{error}</div>}
  </section>
  <footer>Private room · No account required · Real-time sync</footer>
 </main>
}

function Room({room,me,onLeave,setRoom}){
 const [current,setCurrent]=useState(room);
 useEffect(()=>{
  setCurrent(room);
  const channel=supabase.channel("room-"+room.code)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"rooms",filter:`code=eq.${room.code}`},payload=>setCurrent(payload.new))
   .subscribe();
  return()=>supabase.removeChannel(channel);
 },[room.code]);
 const isHost=current.host_id===me;
 const player=current.host_id===me?"You":"Partner";
 const opponent=isHost?current.guest_name:current.host_name;
 const update=async(patch)=>{
  const {data,error}=await supabase.from("rooms").update(patch).eq("code",current.code).select().single();
  if(!error)setCurrent(data);
 };
 if(!current.guest_id) return <main className="room-page"><button className="back" onClick={onLeave}>← Leave</button><div className="waiting"><span className="big-heart">💌</span><span className="eyebrow">ROOM CREATED</span><h1>Send this code</h1><div className="room-code">{current.code}</div><button className="secondary" onClick={()=>navigator.clipboard?.writeText(current.code)}>Copy code</button><p>Waiting for your partner to join…</p><div className="loader">● ● ●</div></div></main>;
 return <main className="room-page"><div className="room-top"><button className="back" onClick={onLeave}>← Leave</button><div className="room-badge">ROOM <b>{current.code}</b></div></div><div className="players"><div>❤️ <b>{current.host_name}</b><small>Player 1</small></div><span>VS</span><div>💕 <b>{current.guest_name}</b><small>Player 2</small></div></div><Game game={current.game} room={current} me={me} isHost={isHost} update={update}/></main>
}

function Game({game,room,me,isHost,update}){
 if(game==="tictactoe")return <TicTacToe room={room} me={me} isHost={isHost} update={update}/>;
 if(game==="rps")return <RPS room={room} me={me} isHost={isHost} update={update}/>;
 if(game==="wouldrather")return <WouldRather room={room} me={me} update={update}/>;
 return <WhoKnows room={room} me={me} update={update}/>;
}

function initialState(game){
 if(game==="tictactoe")return {board:Array(9).fill(null),turn:"host",winner:null};
 if(game==="rps")return {host:null,guest:null,result:null};
 if(game==="wouldrather")return {i:0,answers:{},revealed:false,matches:0,done:false};
 return {i:0,answers:{},revealed:false,matches:0,done:false};
}

function GameShell({title,icon,children,reset}){
 return <section className="game-panel"><div className="game-title"><span>{icon}</span><div><span className="eyebrow">LIVE GAME</span><h2>{title}</h2></div></div>{children}{reset&&<button className="secondary" onClick={reset}>Restart</button>}</section>
}

function TicTacToe({room,me,isHost,update}){
 const s=room.state||initialState("tictactoe");const mine=isHost?"host":"guest";
 const move=i=>{
  if(s.board[i]||s.winner||s.turn!==mine)return;
  const b=[...s.board];b[i]=mine;
  const w=winner(b);update({state:{...s,board:b,winner:w||null,turn:w?mine:(mine==="host"?"guest":"host")},status:w?"finished":"playing"});
 };
 const reset=()=>update({state:initialState("tictactoe"),status:"playing"});
 return <GameShell title="Tic Tac Toe" icon="⭕" reset={s.winner||s.board.every(Boolean)?reset:null}><p className="hint">You are <b>{mine==="host"?"X":"O"}</b> · {s.winner?s.winner+" wins!":s.turn===mine?"Your turn":"Waiting for partner"}</p><div className="ttt">{s.board.map((v,i)=><button key={i} onClick={()=>move(i)} className={v||""}>{v==="host"?"X":v==="guest"?"O":""}</button>)}</div>{s.winner&&<div className="result">🎉 {s.winner==="host"?"Player 1":"Player 2"} wins!</div>}</GameShell>
}
function winner(b){for(const [a,c,d]of[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a];return null}

function RPS({room,isHost,update}){
 const s=room.state||initialState("rps");const mine=isHost?"host":"guest";const other=mine==="host"?"guest":"host";
 const choose=x=>{if(s[mine])return;const next={...s,[mine]:x};if(next.host&&next.guest)next.result=resolve(next.host,next.guest);update({state:next,status:next.result?"finished":"playing"})};
 const reset=()=>update({state:initialState("rps"),status:"playing"});
 return <GameShell title="Rock Paper Scissors" icon="✊" reset={s.result?reset:null}><p className="hint">{s.result?"Round complete":s[mine]?"Locked in! Waiting for partner…":"Choose secretly. Your choice stays hidden."}</p><div className="rps"><div><small>You</small><strong>{s[mine]?"🔒":"?"}</strong></div><span>VS</span><div><small>Partner</small><strong>{s[other]?"🔒":"?"}</strong></div></div><div className="choices">{[["✊","rock"],["✋","paper"],["✌️","scissors"]].map(([i,x])=><button key={x} disabled={!!s[mine]} onClick={()=>choose(x)}>{i}<small>{x}</small></button>)}</div>{s.result&&<div className="result">{s.result}</div>}</GameShell>
}
function resolve(a,b){if(a===b)return"Draw! 🤝";return((a==="rock"&&b==="scissors")||(a==="paper"&&b==="rock")||(a==="scissors"&&b==="paper"))?"You win! 🎉":"Partner wins! ❤️"}

function WouldRather({room,me,update}){
 return <ChoiceGame type="wouldrather" title="Would You Rather" icon="🤔" questions={WR} room={room} me={me} update={update}/>;
}
function WhoKnows({room,me,update}){
 return <ChoiceGame type="whoknows" title="Who Knows Who?" icon="👀" questions={WK.map(q=>[q,"You","Partner"])} room={room} me={me} update={update}/>;
}
function ChoiceGame({type,title,icon,questions,room,me,update}){
 const s=room.state||initialState(type),mine=room.host_id===me?"host":"guest",other=mine==="host"?"guest":"host",q=questions[s.i];
 const choose=v=>{if(s.answers[mine]!=null)return;const answers={...s.answers,[mine]:v};const revealed=answers.host!=null&&answers.guest!=null;update({state:{...s,answers,revealed},status:"playing"})};
 const next=()=>{const same=s.answers.host===s.answers.guest;const ni=s.i+1;if(ni>=questions.length)update({state:{...initialState(type),i:0,done:true,matches:(s.matches||0)+(same?1:0)},status:"finished"});else update({state:{...initialState(type),i:ni,matches:(s.matches||0)+(same?1:0)},status:"playing"})};
 const reset=()=>update({state:initialState(type),status:"playing"});
 if(s.done)return <GameShell title={title} icon={icon}><div className="result">💕 You matched {s.matches}/{questions.length}<button className="primary" onClick={reset}>Play again</button></div></GameShell>;
 return <GameShell title={title} icon={icon}><div className="progress">Question {s.i+1} / {questions.length}</div><h3 className="question">{q[0]}</h3><div className="two-cols"><Choice name="You" value={s.answers[mine]} options={q.slice(1)} disabled={s.answers[mine]!=null} onPick={choose}/><div className="partner-card"><b>Partner</b><span>{s.revealed?(s.answers[other]??"—"):"🔒 Hidden"}</span></div></div>{s.revealed&&<button className="primary next" onClick={next}>Reveal → Next</button>}<p className="hint">Pick without looking at each other's answer.</p></GameShell>
}
function Choice({name,value,options,onPick,disabled}){return <div className="choice-card"><b>{name}</b>{options.map((o,i)=><button disabled={disabled} className={value===o?"selected":""} key={o} onClick={()=>onPick(o)}>{String.fromCharCode(65+i)} · {o}</button>)}</div>}

createRoot(document.getElementById("root")).render(<App/>);
