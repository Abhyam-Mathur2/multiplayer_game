import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabase';
import './Scribble.css';
import { generateGameContent } from '../../services/gameContent';

const WORDS = {
  Animals: ["ELEPHANT", "GIRAFFE", "PENGUIN", "KANGAROO", "TIGER", "RABBIT"],
  Food: ["PIZZA", "HAMBURGER", "ICE CREAM", "SUSHI", "PANCAKE", "APPLE"],
  Objects: ["TELEPHONE", "COMPUTER", "GUITAR", "BICYCLE", "AIRPLANE", "CLOCK"],
  Places: ["HOSPITAL", "BEACH", "MOUNTAIN", "CASTLE", "SCHOOL", "BRIDGE"]
};

export const scribbleInitialState = (wordInfo = null) => {
  let cat, word;
  if (wordInfo) {
    cat = wordInfo.category;
    word = wordInfo.word;
  } else {
    const cats = Object.keys(WORDS);
    cat = cats[Math.floor(Math.random() * cats.length)];
    const words = WORDS[cat];
    word = words[Math.floor(Math.random() * words.length)];
  }
  return {
    word,
    category: cat,
    strokes: [], // saved completed strokes for reconnects
    drawer: "host", // host starts as drawer
    winner: null,
    guesses: [], // chat history
    score: { host: 0, guest: 0 },
    round: 1,
    generating: !wordInfo
  };
};

export default function Scribble({ room, me, isHost, update }) {
  const s = room.state || scribbleInitialState();
  const mine = isHost ? "host" : "guest";
  const isDrawer = s.drawer === mine;
  
  useEffect(() => {
    if (isHost && s.generating && s.word === WORDS.Animals[0] || s.generating) {
      generateGameContent('scribble', 1, room.code).then(newWords => {
        if (newWords.length > 0) {
          update({ state: { ...s, word: newWords[0].word.toUpperCase(), category: newWords[0].category, generating: false } });
        } else {
          update({ state: { ...s, generating: false } }); // keep fallback
        }
      });
    }
  }, [isHost, s.generating, room.code]);
  
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [thickness, setThickness] = useState(3);
  const currentStroke = useRef([]);
  const channelRef = useRef(null);
  const [guessInput, setGuessInput] = useState('');

  // Setup canvas and sync
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Resize for high DPI
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    redrawAll(s.strokes, ctx);

    // Setup realtime broadcast channel
    const ch = supabase.channel(`draw-${room.code}`)
      .on('broadcast', { event: 'stroke_part' }, ({ payload }) => {
        if (!isDrawer) {
          drawStrokePart(payload, ctxRef.current);
        }
      })
      .on('broadcast', { event: 'clear' }, () => {
        if (!isDrawer) {
          ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
        }
      })
      .subscribe();
      
    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
    };
  }, [room.code, isDrawer]);

  // Redraw when strokes change from DB (reconnect or stroke complete)
  useEffect(() => {
    if (ctxRef.current && !drawing) {
      redrawAll(s.strokes, ctxRef.current);
    }
  }, [s.strokes]);

  const redrawAll = (strokes, ctx) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.thickness;
      const first = stroke.points[0];
      ctx.moveTo(first.x * ctx.canvas.width, first.y * ctx.canvas.height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * ctx.canvas.width, stroke.points[i].y * ctx.canvas.height);
      }
      ctx.stroke();
    });
  };

  const drawStrokePart = (payload, ctx) => {
    if (!ctx || !payload.p1 || !payload.p2) return;
    ctx.beginPath();
    ctx.strokeStyle = payload.color;
    ctx.lineWidth = payload.thickness;
    ctx.moveTo(payload.p1.x * ctx.canvas.width, payload.p1.y * ctx.canvas.height);
    ctx.lineTo(payload.p2.x * ctx.canvas.width, payload.p2.y * ctx.canvas.height);
    ctx.stroke();
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const startDraw = (e) => {
    if (!isDrawer || s.winner) return;
    setDrawing(true);
    const pos = getPos(e);
    currentStroke.current = [pos];
  };

  const moveDraw = (e) => {
    if (!isDrawer || !drawing || s.winner) return;
    const pos = getPos(e);
    const lastPos = currentStroke.current[currentStroke.current.length - 1];
    currentStroke.current.push(pos);
    
    // Draw locally
    drawStrokePart({ p1: lastPos, p2: pos, color, thickness }, ctxRef.current);
    
    // Broadcast
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'stroke_part',
        payload: { p1: lastPos, p2: pos, color, thickness }
      });
    }
  };

  const endDraw = () => {
    if (!isDrawer || !drawing || s.winner) return;
    setDrawing(false);
    if (currentStroke.current.length > 1) {
      const newStroke = {
        points: currentStroke.current,
        color,
        thickness
      };
      // Save to DB
      update({ state: { ...s, strokes: [...s.strokes, newStroke] } });
    }
    currentStroke.current = [];
  };

  const clearCanvas = () => {
    if (!isDrawer) return;
    update({ state: { ...s, strokes: [] } });
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'clear' });
    }
  };

  const submitGuess = (e) => {
    e.preventDefault();
    if (isDrawer || s.winner || !guessInput.trim()) return;
    
    const text = guessInput.trim().toUpperCase();
    const newGuesses = [...s.guesses, { text, from: mine, time: Date.now() }];
    
    if (text === s.word) {
      // WIN
      const newScore = { ...s.score };
      newScore[mine] += 1; // guesser gets a point
      newScore[s.drawer] += 1; // drawer gets a point too
      
      update({ 
        state: { 
          ...s, 
          guesses: [...newGuesses, { text: "CORRECT! 🎉", sys: true }],
          winner: mine,
          score: newScore
        } 
      });
    } else {
      update({ state: { ...s, guesses: newGuesses } });
    }
    setGuessInput('');
  };

  const nextRound = () => {
    const nextS = scribbleInitialState();
    // Swap drawer
    nextS.drawer = s.drawer === "host" ? "guest" : "host";
    nextS.score = s.score;
    nextS.round = s.round + 1;
    nextS.generating = true;
    update({ state: nextS, status: "playing" });
  };

  if (s.generating) {
    return (
      <div className="scribble-game">
        <div className="game-header"><h3>Scribble</h3></div>
        <div style={{textAlign: 'center', padding: '2rem'}}>
          <h3>Creating your next challenge ✨</h3>
          <p>Generating AI word...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scribble-game">
      <div className="game-header">
        <h3>Scribble - Round {s.round}</h3>
        <div className="score">You: {s.score[mine]} - Partner: {s.score[isHost ? 'guest' : 'host']}</div>
        {!s.winner && (
          <div className="word-hint">
            {isDrawer ? (
              <span>Draw: <b>{s.word}</b> (Category: {s.category})</span>
            ) : (
              <span>Guess the word! Category: <b>{s.category}</b></span>
            )}
          </div>
        )}
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={(e) => { e.preventDefault(); startDraw(e); }}
          onTouchMove={(e) => { e.preventDefault(); moveDraw(e); }}
          onTouchEnd={(e) => { e.preventDefault(); endDraw(e); }}
        />
        {s.winner && (
          <div className="result-overlay">
            <h2>{s.winner === mine ? (isDrawer ? "Partner guessed it!" : "You guessed it!") : (isDrawer ? "Partner guessed it!" : "Partner got it!")}</h2>
            <p>The word was: <b>{s.word}</b></p>
            {isHost && <button className="primary" onClick={nextRound}>Next Round</button>}
            {!isHost && <p>Waiting for host...</p>}
          </div>
        )}
      </div>

      {isDrawer ? (
        <div className="drawing-tools">
          <div className="colors">
            {['#ffffff', '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#000000'].map(c => (
              <button 
                key={c} 
                className={`color-btn ${color === c ? 'active' : ''}`}
                style={{ background: c, border: c === '#000000' ? '1px solid #fff' : 'none' }}
                onClick={() => { setColor(c); setThickness(3); }}
              />
            ))}
            <button className="eraser-btn" onClick={() => { setColor('#1a1a2e'); setThickness(20); }}>Eraser</button>
          </div>
          <button className="secondary" onClick={clearCanvas}>Clear</button>
        </div>
      ) : (
        <div className="guess-section">
          <div className="chat">
            {s.guesses.slice(-5).map((g, i) => (
              <div key={i} className={`chat-msg ${g.sys ? 'sys' : ''}`}>
                {!g.sys && <b>{g.from === mine ? 'You' : 'Partner'}: </b>}
                {g.text}
              </div>
            ))}
          </div>
          <form onSubmit={submitGuess} className="guess-form">
            <input 
              type="text" 
              value={guessInput} 
              onChange={e => setGuessInput(e.target.value)} 
              placeholder="Type your guess..."
              disabled={!!s.winner}
            />
            <button type="submit" disabled={!guessInput.trim() || !!s.winner}>Send</button>
          </form>
        </div>
      )}
    </div>
  );
}
