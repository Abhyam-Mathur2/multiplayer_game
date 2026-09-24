import { supabase } from '../supabase';

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateGameContent(game, count, roomCode) {
  try {
    // 1. Fetch recent history from DB for this room to avoid duplicates
    const { data: history } = await supabase
      .from('game_content_history')
      .select('content_text, content_hash')
      .eq('room_id', roomCode)
      .eq('game_type', game)
      .order('created_at', { ascending: false })
      .limit(50);

    const previousTexts = history ? history.map(h => h.content_text) : [];
    const previousHashes = history ? history.map(h => h.content_hash) : [];

    // 2. Call our Vercel API
    const res = await fetch('/api/generate-game-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game,
        count,
        previousTexts,
        roomInfo: roomCode
      })
    });

    if (!res.ok) throw new Error('Failed to generate content');
    const data = await res.json();

    // 3. Extract items and deduplicate based on hash
    let items = [];
    if (game === 'trivia' && data.questions) items = data.questions;
    if (game === 'hangman' && data.words) items = data.words;
    if (game === 'scribble' && data.words) items = data.words;
    if (game === 'wouldYouRather' && data.questions) items = data.questions;
    if (game === 'whoKnowsWho' && data.questions) items = data.questions;

    const validItems = [];
    for (const item of items) {
      let textToHash = '';
      if (item.question) textToHash = item.question;
      if (item.word) textToHash = item.word;
      
      const normalized = textToHash.toLowerCase().replace(/[^a-z0-9]/g, '');
      const hash = await sha256(normalized);

      if (!previousHashes.includes(hash)) {
        validItems.push(item);
        // Save to history async
        supabase.from('game_content_history').insert({
          game_type: game,
          content_text: textToHash,
          content_hash: hash,
          room_id: roomCode
        }).then();
      }
    }

    return validItems;
  } catch (error) {
    console.error('Error in generateGameContent:', error);
    return [];
  }
}
