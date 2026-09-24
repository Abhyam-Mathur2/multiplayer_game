export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not set' });
  }

  try {
    const { game, count = 10, previousHashes = [], previousTexts = [], roomInfo } = req.body;
    
    if (!['trivia', 'hangman', 'wouldYouRather', 'whoKnowsWho', 'scribble'].includes(game)) {
      return res.status(400).json({ error: 'Invalid game type' });
    }

    const maxCount = Math.min(count, 20);

    let systemPrompt = `You are a creative AI game content generator. Return ONLY strict, valid JSON.`;
    let userPrompt = `Generate ${maxCount} new items for the game '${game}'.`;

    if (previousTexts.length > 0) {
      userPrompt += `\n\nDO NOT generate any items semantically similar to these previously used items:\n- ${previousTexts.slice(0, 50).join('\n- ')}`;
    }

    if (game === 'trivia') {
      systemPrompt += ` Generate trivia questions. Use categories like Technology, Science, Geography, Movies, Music, Food, Relationships. Ensure 4 options and 1 correct answer. Format: { "questions": [ { "question": "...", "options": ["...","...","...","..."], "correctAnswer": 0, "category": "..." } ] }`;
    } else if (game === 'hangman') {
      systemPrompt += ` Generate words for Hangman. Use categories like Animals, Food, Movies, Technology, Places, Objects, Random. Include a hint. Format: { "words": [ { "word": "UPPERCASEWORD", "category": "...", "hint": "..." } ] }`;
    } else if (game === 'scribble') {
      systemPrompt += ` Generate words for a drawing game. Must be highly recognizable nouns (e.g. PIZZA, TELESCOPE). Format: { "words": [ { "word": "UPPERCASEWORD", "category": "..." } ] }`;
    } else if (game === 'wouldYouRather') {
      systemPrompt += ` Generate fun "Would you rather" questions for couples/friends. Format: { "questions": [ { "question": "Would you rather X or Y?" } ] }`;
    } else if (game === 'whoKnowsWho') {
      systemPrompt += ` Generate "Who is more likely to..." or "Who..." questions for couples/friends. Format: { "questions": [ { "question": "Who is more likely to...?" } ] }`;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Attempt to parse JSON
    const parsed = JSON.parse(content);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Groq Generation Error:', err);
    return res.status(500).json({ error: 'Failed to generate content' });
  }
}
