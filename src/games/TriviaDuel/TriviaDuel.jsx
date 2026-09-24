import React, { useEffect, useState } from 'react';
import './TriviaDuel.css';
import { getTriviaDeck } from './triviaData';
import { generateGameContent } from '../../services/gameContent';

export const triviaInitialState = () => {
  return {
    deck: [], // start empty, will fetch
    i: 0,
    answers: {},
    revealed: false,
    score: { host: 0, guest: 0 },
    done: false,
    deadline: null,
    generating: true
  };
};

export default function TriviaDuel({ room, me, isHost, update }) {
  const s = room.state || triviaInitialState();
  const mine = isHost ? "host" : "guest";
  const other = isHost ? "guest" : "host";
  const q = s.deck && s.deck.length > 0 ? s.deck[s.i] : null;

  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    // Host generates questions if empty
    if (isHost && s.generating && (!s.deck || s.deck.length === 0)) {
      generateGameContent('trivia', 10, room.code).then(newQuestions => {
        const finalDeck = newQuestions.length > 0 ? newQuestions.map(q => ({
          q: q.question,
          opts: q.options,
          a: q.correctAnswer
        })) : getTriviaDeck(5); // fallback
        
        update({ state: { ...s, deck: finalDeck, generating: false, deadline: Date.now() + 10000 } });
      });
    }
  }, [isHost, s.generating, s.deck]);

  useEffect(() => {
    if (s.done || s.revealed || !s.deadline) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        // Time's up
        if (!s.answers[mine] && isHost) {
           // Host resolves timeout to avoid race conditions
           handleReveal({...s.answers});
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [s.deadline, s.done, s.revealed, s.answers, isHost, mine]);

  const handleReveal = (currentAnswers) => {
    let newScore = { ...s.score };
    if (currentAnswers.host === q.a) newScore.host += 1;
    if (currentAnswers.guest === q.a) newScore.guest += 1;
    update({ state: { ...s, answers: currentAnswers, revealed: true, score: newScore } });
  };

  const choose = (optIndex) => {
    if (s.answers[mine] != null || s.revealed || timeLeft === 0) return;
    const newAnswers = { ...s.answers, [mine]: optIndex };
    
    if (newAnswers.host != null && newAnswers.guest != null && isHost) {
      handleReveal(newAnswers);
    } else {
      update({ state: { ...s, answers: newAnswers } });
    }
  };

  const next = () => {
    const ni = s.i + 1;
    if (ni >= s.deck.length) {
      update({ state: { ...s, done: true }, status: "finished" });
    } else {
      update({ state: { ...s, i: ni, answers: {}, revealed: false, deadline: Date.now() + 10000 }, status: "playing" });
    }
  };

  const reset = () => update({ state: { ...triviaInitialState(), score: s.score }, status: "playing" });

  if (s.generating) {
    return (
      <section className="game-panel trivia-game">
        <div className="game-title"><span>⏱️</span><div><h2>Trivia Duel</h2></div></div>
        <div style={{textAlign: 'center', padding: '2rem'}}>
          <h3>Thinking of something new for you two... 💜</h3>
          <p>Generating AI questions...</p>
        </div>
      </section>
    );
  }

  if (!q) return null;

  if (s.done) {
    const hw = s.score.host > s.score.guest;
    const gw = s.score.guest > s.score.host;
    return (
      <section className="game-panel trivia-game">
        <div className="game-title"><span>⏱️</span><div><h2>Trivia Duel</h2></div></div>
        <div className="result">
          <h3>Final Score</h3>
          <p>You: {s.score[mine]} - Partner: {s.score[other]}</p>
          <h2>{s.score[mine] > s.score[other] ? 'You Win! 🎉' : s.score[mine] < s.score[other] ? 'Partner Wins! ❤️' : 'It\'s a Tie! 🤝'}</h2>
          <button className="primary" onClick={reset}>Play again</button>
        </div>
      </section>
    );
  }

  return (
    <section className="game-panel trivia-game">
      <div className="game-title">
        <span>⏱️</span>
        <div><span className="eyebrow">LIVE GAME</span><h2>Trivia Duel</h2></div>
      </div>
      
      <div className="trivia-header">
        <div className="progress">Q {s.i + 1} / {s.deck.length}</div>
        <div className="timer" style={{ color: timeLeft <= 3 ? '#e74c3c' : 'inherit' }}>{s.revealed ? '0' : timeLeft}s</div>
        <div className="score">Score: {s.score[mine]} - {s.score[other]}</div>
      </div>

      <h3 className="question">{q.q}</h3>
      
      <div className="trivia-options">
        {q.opts.map((opt, i) => {
          let className = "trivia-btn ";
          if (s.revealed) {
            if (i === q.a) className += "correct ";
            else if (s.answers[mine] === i || s.answers[other] === i) className += "wrong ";
          } else {
            if (s.answers[mine] === i) className += "selected ";
          }

          return (
            <button 
              key={i} 
              disabled={s.answers[mine] != null || s.revealed}
              className={className}
              onClick={() => choose(i)}
            >
              {opt}
              {s.revealed && (
                <div className="player-badges">
                  {s.answers[mine] === i && <span className="badge me">You</span>}
                  {s.answers[other] === i && <span className="badge partner">Partner</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="status-text">
        {!s.revealed && s.answers[mine] != null && <p>Waiting for partner...</p>}
        {!s.revealed && s.answers[mine] == null && s.answers[other] != null && <p>Partner answered!</p>}
      </div>

      {s.revealed && isHost && (
        <button className="primary next" onClick={next}>Next Question →</button>
      )}
      {s.revealed && !isHost && (
        <p className="hint">Waiting for host to continue...</p>
      )}
    </section>
  );
}
