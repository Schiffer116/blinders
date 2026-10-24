// One quote is picked at random each time the blocked page loads.
// Only lines with a known source are included; sayings with no reliable origin are marked 'attributed'.
// Translations: Marcus Aurelius from George Long (1862); Plutarch, Suetonius and Arrian from older public-domain
// English translations; Caesar's own works and Napoleon's letter translated plainly from the Latin/French.

export const QUOTES = [
  { author: 'Marcus Aurelius', text: 'Remember how long thou hast been putting off these things, and how often thou hast received an opportunity from the gods, and yet dost not use it.', source: 'Meditations 2.4' },
  { author: 'Marcus Aurelius', text: 'Thou wilt give thyself relief, if thou doest every act of thy life as if it were the last.', source: 'Meditations 2.5' },
  { author: 'Marcus Aurelius', text: 'The universe is transformation: life is opinion.', source: 'Meditations 4.3' },
  { author: 'Marcus Aurelius', text: 'Do not act as if thou wert going to live ten thousand years. Death hangs over thee. While thou livest, while it is in thy power, be good.', source: 'Meditations 4.17' },
  { author: 'Marcus Aurelius', text: 'Occupy thyself with few things, says the philosopher, if thou wouldst be tranquil.', source: 'Meditations 4.24' },
  { author: 'Marcus Aurelius', text: 'Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts.', source: 'Meditations 5.16' },
  { author: 'Marcus Aurelius', text: 'The perfection of moral character consists in this, in passing every day as the last, and in being neither violently excited nor torpid nor playing the hypocrite.', source: 'Meditations 7.69' },
  { author: 'Marcus Aurelius', text: 'If thou art pained by any external thing, it is not this thing that disturbs thee, but thy own judgement about it. And it is in thy power to wipe out this judgement now.', source: 'Meditations 8.47' },
  { author: 'Marcus Aurelius', text: 'No longer talk at all about the kind of man that a good man ought to be, but be such.', source: 'Meditations 10.16' },

  { author: 'Julius Caesar', text: 'I came, I saw, I conquered.', source: 'Suetonius, Life of Julius Caesar 37' },
  { author: 'Julius Caesar', text: 'The die is cast.', source: 'Suetonius, Life of Julius Caesar 32' },
  { author: 'Julius Caesar', text: 'Men generally believe what they want to believe.', source: 'The Gallic War 3.18' },
  { author: 'Julius Caesar', text: 'In war, great events turn on small matters.', source: 'The Civil War 1.21' },

  { author: 'Alexander the Great', text: 'It is a very slavish thing to be luxurious, but a very royal thing to toil.', source: 'Plutarch, Life of Alexander 40' },
  { author: 'Alexander the Great', text: 'For my part, I had rather excel others in the knowledge of what is excellent than in the extent of my power.', source: 'Plutarch, Life of Alexander 7' },
  { author: 'Alexander the Great', text: 'If I were not Alexander, I would be Diogenes.', source: 'Plutarch, Life of Alexander 14' },
  { author: 'Alexander the Great', text: 'For a man of noble spirit there is no limit to his labours, except that the labours themselves should lead to noble deeds.', source: 'Arrian, Anabasis 5.26' },

  { author: 'Napoleon Bonaparte', text: 'You write to me that it is impossible; that word is not French.', source: 'letter to General Lemarois, 1813' },
  { author: 'Napoleon Bonaparte', text: 'From the sublime to the ridiculous there is but one step.', source: 'as recorded by the Abbé de Pradt, 1812' },
  { author: 'Napoleon Bonaparte', text: 'Space we can recover; lost time, never.', source: 'attributed' },
  { author: 'Napoleon Bonaparte', text: 'Ask me for anything but time.', source: 'attributed' },
];

export function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
