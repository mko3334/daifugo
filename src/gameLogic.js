/**
 * 大富豪コアロジック
 * UIに依存しない純粋な関数群
 */

export const SUITS = ['spade', 'heart', 'diamond', 'club'];
export const VALUES = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

// カードの強さを定義 (3が最小、2が最大、ジョーカーは別途考慮)
const POWER_MAP = {
  '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6,
  '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12, 'JOKER': 13
};

/**
 * デッキ生成
 */
export const createDeck = (jokerCount = 2) => {
  const deck = [];
  SUITS.forEach(suit => {
    VALUES.forEach(value => {
      deck.push({
        id: `${suit}-${value}`,
        suit,
        value,
        power: POWER_MAP[value],
        image: `/cards/${suit}_${value}.png` // 画像パスの予約
      });
    });
  });

  for (let i = 0; i < jokerCount; i++) {
    deck.push({
      id: `joker-${i}`,
      suit: 'joker',
      value: 'JOKER',
      power: POWER_MAP['JOKER'],
      image: `/cards/joker.png`
    });
  }
  return deck;
};

/**
 * シャッフル (Fisher-Yates)
 */
export const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * カード配布
 */
export const dealCards = (deck, playerCount) => {
  const hands = Array.from({ length: playerCount }, () => []);
  deck.forEach((card, index) => {
    hands[index % playerCount].push(card);
  });
  // 手札を強さ順にソートしておく
  return hands.map(hand => hand.sort((a, b) => a.power - b.power));
};

/**
 * 選択されたカードが有効なセット（同じ数字のペア、または階段）かチェック
 */
export const isValidSet = (cards) => {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;

  // 全て同じ数字かチェック (ペア)
  const isPair = cards.every(c => c.value === cards[0].value || c.value === 'JOKER');
  if (isPair) return true;

  // 階段のチェック (同じスートで数字が連続)
  if (cards.length >= 3) {
    const suit = cards.find(c => c.suit !== 'joker')?.suit;
    const sorted = [...cards].sort((a, b) => a.power - b.power);
    const isSequence = sorted.every((c, i) => {
      if (i === 0) return true;
      if (c.suit !== suit && c.suit !== 'joker') return false;
      return c.power === sorted[i - 1].power + 1;
    });
    if (isSequence) return true;
  }

  return false;
};

/**
 * 場に出せるか判定
 */
export const canPlayCards = (lastCards, selectedCards, isRevolution = false) => {
  if (!isValidSet(selectedCards)) return false;

  // 場が空なら何でも出せる
  if (!lastCards || lastCards.length === 0) return true;

  // 枚数が違うと出せない
  if (lastCards.length !== selectedCards.length) return false;

  // セット形式（単発、ペア、階段）が一致しているかチェック
  const getSetType = (cards) => {
    if (cards.length === 1) return 'single';
    const isPair = cards.every(c => c.value === cards[0].value || c.suit === 'joker');
    if (isPair) return 'pair';
    return 'sequence';
  };

  const lastType = getSetType(lastCards);
  const selectedType = getSetType(selectedCards);

  if (lastType !== selectedType) return false;

  // 強さの比較
  const getLastPower = () => {
    const sorted = [...lastCards].sort((a, b) => a.power - b.power);
    return sorted[0].power;
  };
  const getSelectedPower = () => {
    const sorted = [...selectedCards].sort((a, b) => a.power - b.power);
    return sorted[0].power;
  };

  const lastPower = getLastPower();
  const selectedPower = getSelectedPower();

  if (isRevolution) {
    return selectedPower < lastPower;
  } else {
    return selectedPower > lastPower;
  }
};
