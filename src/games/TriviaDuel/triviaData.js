export const TRIVIA_QUESTIONS = [
  { q: "What is the largest planet in our solar system?", opts: ["Earth", "Jupiter", "Saturn", "Mars"], a: 1 },
  { q: "Which movie won the first Academy Award for Best Picture?", opts: ["Wings", "Metropolis", "Sunrise", "The Jazz Singer"], a: 0 },
  { q: "Who painted the Mona Lisa?", opts: ["Van Gogh", "Picasso", "Da Vinci", "Rembrandt"], a: 2 },
  { q: "What is the hardest natural substance on Earth?", opts: ["Gold", "Iron", "Diamond", "Platinum"], a: 2 },
  { q: "Which animal is known as the 'Ship of the Desert'?", opts: ["Horse", "Camel", "Elephant", "Donkey"], a: 1 },
  { q: "How many continents are there?", opts: ["5", "6", "7", "8"], a: 2 },
  { q: "What is the chemical symbol for Gold?", opts: ["Ag", "Au", "Pb", "Fe"], a: 1 },
  { q: "Which country is famous for the Taj Mahal?", opts: ["Egypt", "India", "Turkey", "China"], a: 1 },
  { q: "Who wrote 'Romeo and Juliet'?", opts: ["Charles Dickens", "William Shakespeare", "Mark Twain", "Jane Austen"], a: 1 },
  { q: "What is the fastest land animal?", opts: ["Cheetah", "Lion", "Leopard", "Tiger"], a: 0 }
];

// Randomize options and return in a standard format
export const getTriviaDeck = (count = 5) => {
  const shuffled = [...TRIVIA_QUESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(item => {
    // We could shuffle options here, but let's keep it simple and just use the predefined ones
    // and store the correct index.
    return item;
  });
};
