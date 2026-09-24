import React, { useEffect } from 'react';
import './Hangman.css';
import { generateGameContent } from '../../services/gameContent';

const WORDS = {
  Love: ["ROMANCE", "CUDDLE", "FOREVER", "KISS", "SOULMATE", "HONEYMOON"],
  Movies: ["TITANIC", "AVATAR", "INCEPTION", "GLADIATOR", "MATRIX"],
  Food: ["PIZZA", "BURGER", "SUSHI", "PASTA", "TACO", "CHOCOLATE"],
  Travel: ["PARIS", "LONDON", "TOKYO", "BEACH", "MOUNTAIN"],
  General: ["HAPPINESS", "ADVENTURE", "MYSTERY", "GARDEN"],
  Random: ["UMBRELLA", "TELEPHONE", "GUITAR", "KEYBOARD"]
};

export const hangmanInitialState = (wordInfo = null) => {
  let cat, word, hint;
  if (wordInfo) {
    cat = wordInfo.category;
    word = wordInfo.word;
    hint = wordInfo.hint;
  } else {
    // Fallback
    const cats = Object.keys(WORDS);
    cat = cats[Math.floor(Math.random() * cats.length)];
    const words = WORDS[cat];
    word = words[Math.floor(Math.random() * words.length)];
    hint = "";
  }
  
  return {
    category: cat,
    word: word,
    hint: hint,
    guessed: [],
    errors: 0,
    winner: null,
    score: { host: 0, guest: 0 },
    round: 1,
    generating: !wordInfo
  };
};

export default function Hangman({ room, me, isHost, update }) {
  const s = room.state || hangmanInitialState();
  
  useEffect(() => {
    if (isHost && s.generating && s.word === 'UMBRELLA' || s.generating) {
      generateGameContent('hangman', 1, room.code).then(newWords => {
        if (newWords.length > 0) {
          update({ state: { ...s, word: newWords[0].word.toUpperCase(), category: newWords[0].category, hint: newWords[0].hint, generating: false } });
        } else {
          update({ state: { ...s, generating: false } }); // keep fallback
        }
      });
    }
  }, [isHost, s.generating, room.code]);
  
  const mine = isHost ? "host" : "guest";
  const maxErrors = 6;
  const wordSet = new Set(s.word.split(''));
  
  const guess = (letter) => {
    if (s.guessed.includes(letter) || s.winner || s.errors >= maxErrors) return;
    const newGuessed = [...s.guessed, letter];
    let newErrors = s.errors;
    let newWinner = null;
    const newScore = { ...s.score };
    
    if (!wordSet.has(letter)) {
      newErrors++;
      if (newErrors >= maxErrors) {
        newWinner = 'loss';
      }
    } else {
      const isWin = s.word.split('').every(c => newGuessed.includes(c) || c === ' ');
      if (isWin) {
        newWinner = 'win';
        newScore[mine] = (newScore[mine] || 0) + 1;
      }
    }
    
    update({ state: { ...s, guessed: newGuessed, errors: newErrors, winner: newWinner, score: newScore } });
  };
  
  const nextRound = () => {
    update({ state: { ...s, generating: true, winner: null }, status: "playing" });
  };

  const keyboard = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
  
  if (s.generating) {
    return (
      <div className="hangman-game">
        <div className="game-header"><h3>Hangman</h3></div>
        <div style={{textAlign: 'center', padding: '2rem'}}>
          <h3>Creating your next challenge ✨</h3>
          <p>Generating AI word...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="hangman-game">
      <div className="game-header">
        <h3>Hangman - Round {s.round}</h3>
        <div className="score">You: {s.score[mine] || 0} - Partner: {s.score[isHost ? 'guest' : 'host'] || 0}</div>
        <div className="category">Category: <b>{s.category}</b></div>
        {s.hint && <div className="hint-text" style={{fontStyle:'italic', opacity:0.8, marginTop:5}}>Hint: {s.hint}</div>}
      </div>
      
      <div className="hangman-visual">
        <div className="errors">Lives remaining: {maxErrors - s.errors}</div>
        {/* Simple visual representation */}
        <div className="gallows">
          <div className="pole"></div>
          {s.errors > 0 && <div className="head">O</div>}
          {s.errors > 1 && <div className="body">|</div>}
          {s.errors > 2 && <div className="arm-l">/</div>}
          {s.errors > 3 && <div className="arm-r">\</div>}
          {s.errors > 4 && <div className="leg-l">/</div>}
          {s.errors > 5 && <div className="leg-r">\</div>}
        </div>
      </div>

      <div className="word-display">
        {s.word.split('').map((c, i) => (
          <span key={i} className="letter">
            {(s.guessed.includes(c) || s.winner === 'loss') ? c : '_'}
          </span>
        ))}
      </div>

      <div className="keyboard">
        {keyboard.map(k => (
          <button 
            key={k} 
            disabled={s.guessed.includes(k) || s.winner}
            onClick={() => guess(k)}
            className={s.guessed.includes(k) ? (wordSet.has(k) ? 'correct' : 'wrong') : ''}
          >
            {k}
          </button>
        ))}
      </div>

      {s.winner && (
        <div className="result-overlay">
          <h2>{s.winner === 'win' ? 'You got it!' : 'Game Over'}</h2>
          <p>The word was: <b>{s.word}</b></p>
          <button className="primary" onClick={nextRound}>Next Round</button>
        </div>
      )}
    </div>
  );
}
