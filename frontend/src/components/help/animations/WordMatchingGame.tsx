'use client';

import React, { useState, useEffect } from 'react';

interface Card {
  id: number;
  text: string;
  type: 'word' | 'definition';
  matched: boolean;
  flipped: boolean;
}

const words = [
  { word: 'Apple', definition: 'A red fruit' },
  { word: 'Book', definition: 'For reading' },
  { word: 'Cat', definition: 'A pet animal' },
  { word: 'Dog', definition: 'Loyal friend' }
];

export default function WordMatchingGame() {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<Card[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    initGame();
  }, []);

  const initGame = () => {
    const newCards: Card[] = [];
    words.forEach((item, index) => {
      newCards.push({ id: index * 2, text: item.word, type: 'word', matched: false, flipped: false });
      newCards.push({ id: index * 2 + 1, text: item.definition, type: 'definition', matched: false, flipped: false });
    });
    newCards.sort(() => Math.random() - 0.5);
    setCards(newCards);
    setFlippedCards([]);
    setMatchedPairs(0);
    setScore(0);
  };

  const flipCard = (id: number) => {
    const card = cards.find(c => c.id === id);
    if (!card || flippedCards.length >= 2 || card.flipped || card.matched) return;

    const newCards = cards.map(c => c.id === id ? { ...c, flipped: true } : c);
    setCards(newCards);
    const newFlipped = [...flippedCards, card];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setTimeout(() => {
        const [card1, card2] = newFlipped;
        const wordIndex1 = words.findIndex(w => w.word === card1.text || w.definition === card1.text);
        const wordIndex2 = words.findIndex(w => w.word === card2.text || w.definition === card2.text);

        if (wordIndex1 === wordIndex2 && wordIndex1 !== -1 && card1.type !== card2.type) {
          const updatedCards = newCards.map(c =>
            c.id === card1.id || c.id === card2.id ? { ...c, matched: true, flipped: true } : c
          );
          setCards(updatedCards);
          setMatchedPairs(prev => prev + 1);
          setScore(prev => prev + 10);
        } else {
          const updatedCards = newCards.map(c =>
            c.id === card1.id || c.id === card2.id ? { ...c, flipped: false } : c
          );
          setCards(updatedCards);
        }
        setFlippedCards([]);
      }, 1000);
    }
  };

  const resetGame = () => {
    initGame();
  };

  const cardSize = 80;
  const gap = 10;
  const cols = 4;
  const rows = 2;

  return (
    <div className="w-full max-w-2xl mx-auto bg-white p-4 rounded-lg border-2 border-pink-500">
      <div className="text-center text-xl font-bold text-pink-500 mb-4">
        Score: <span>{score}</span>
      </div>
      
      <svg
        viewBox={`0 0 ${cols * (cardSize + gap) - gap} ${rows * (cardSize + gap) - gap}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        style={{ touchAction: 'manipulation' }}
      >
        {cards.map((card, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = col * (cardSize + gap);
          const y = row * (cardSize + gap);

          const isFlipped = card.flipped || card.matched;
          const gradientId = card.matched
            ? 'matchedGradient'
            : isFlipped
            ? 'flippedGradient'
            : 'defaultGradient';

          return (
            <g key={card.id}>
              <defs>
                <linearGradient id="defaultGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
                <linearGradient id="flippedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f093fb" />
                  <stop offset="100%" stopColor="#f5576c" />
                </linearGradient>
                <linearGradient id="matchedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4facfe" />
                  <stop offset="100%" stopColor="#00f2fe" />
                </linearGradient>
              </defs>
              <rect
                x={x}
                y={y}
                width={cardSize}
                height={cardSize}
                rx="8"
                fill={`url(#${gradientId})`}
                opacity={card.matched ? 0.6 : 1}
                className={!card.matched ? 'cursor-pointer' : ''}
                style={{
                  transition: 'all 0.3s',
                  transform: isFlipped ? 'scale(1.05)' : 'scale(1)',
                }}
                onClick={() => !card.matched && flipCard(card.id)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (!card.matched) flipCard(card.id);
                }}
              />
              <text
                x={x + cardSize / 2}
                y={y + cardSize / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="14"
                fontWeight="bold"
                fill="white"
                pointerEvents="none"
              >
                {isFlipped ? card.text : '?'}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex justify-center mt-4">
        <button
          onClick={resetGame}
          className="w-12 h-12 p-0 bg-pink-500 text-white rounded border-none cursor-pointer flex items-center justify-center hover:bg-pink-600 active:bg-pink-700 transition-colors touch-manipulation"
          style={{ minWidth: '44px', minHeight: '44px' }}
          title="Reset"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </div>
    </div>
  );
}


