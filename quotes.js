// Marcus Aurelius, Meditations, in George Long's 1862 translation (public domain).
// One is picked at random each time the blocked page loads.

export const QUOTES = [
  { text: 'Remember how long thou hast been putting off these things, and how often thou hast received an opportunity from the gods, and yet dost not use it.', ref: '2.4' },
  { text: 'Thou wilt give thyself relief, if thou doest every act of thy life as if it were the last.', ref: '2.5' },
  { text: 'The universe is transformation: life is opinion.', ref: '4.3' },
  { text: 'Do not act as if thou wert going to live ten thousand years. Death hangs over thee. While thou livest, while it is in thy power, be good.', ref: '4.17' },
  { text: 'Occupy thyself with few things, says the philosopher, if thou wouldst be tranquil.', ref: '4.24' },
  { text: 'Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts.', ref: '5.16' },
  { text: 'The perfection of moral character consists in this, in passing every day as the last, and in being neither violently excited nor torpid nor playing the hypocrite.', ref: '7.69' },
  { text: 'If thou art pained by any external thing, it is not this thing that disturbs thee, but thy own judgement about it. And it is in thy power to wipe out this judgement now.', ref: '8.47' },
  { text: 'No longer talk at all about the kind of man that a good man ought to be, but be such.', ref: '10.16' },
];

export function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
