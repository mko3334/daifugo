import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Crown, Coins, Undo2, ChevronRight, History, X, RotateCcw, Trophy, Plus, Minus, Banknote, HandCoins, Gem, ScrollText, ChevronDown, ChevronUp, Dices, Settings, Volume2, VolumeX, Music, Users, Layers, Hand } from 'lucide-react';
import { createDeck, shuffleDeck, dealCards, canPlayCards } from './gameLogic';

// =====================================
// 定数・設定
// =====================================
const INITIAL_FUNDS = 100_000_000; // 1億円
const BET_UNIT = 1_000_000; // 100万G

const ALL_RANKS = [
  { id: 1, name: '大富豪', reward: 20_000_000, point: 2, bgClass: 'bg-amber-400', textClass: 'text-amber-950', borderClass: 'border-amber-500', icon: '👑' },
  { id: 2, name: '富豪', reward: 10_000_000, point: 1, bgClass: 'bg-zinc-300', textClass: 'text-zinc-900', borderClass: 'border-zinc-400', icon: '💎' },
  { id: 3, name: '貧民', reward: 5_000_000, point: 0, bgClass: 'bg-blue-300', textClass: 'text-blue-950', borderClass: 'border-blue-400', icon: '🫙' },
  { id: 4, name: '大貧民', reward: 2_500_000, point: -1, bgClass: 'bg-violet-400', textClass: 'text-violet-950', borderClass: 'border-violet-500', icon: '💀' },
  { id: 5, name: '平民', reward: 1_000_000, point: 0, bgClass: 'bg-emerald-400', textClass: 'text-emerald-950', borderClass: 'border-emerald-500', icon: '👨‍🌾' },
];

const RANDOM_EVENTS = [
  { id: 'riot', name: '🔥 暴動', desc: '税金が逆転！下位陣が上位陣から搾取します', effectColor: 'text-red-500' },
  { id: 'fall_of_king', name: '👑 トップの没落', desc: '1位のプレイヤーから1000万Gがポットに流出します', effectColor: 'text-purple-400' },
  { id: 'carry_over', name: '🎁 キャリーオーバー', desc: 'このラウンドではポット総取りができません', effectColor: 'text-emerald-400' },
  { id: 'revolution', name: '⚔️ 革命', desc: 'カードの強さが逆転！3が最強、2が最弱になります', effectColor: 'text-rose-500' },
  { id: 'redistribution', name: '🤝 再分配', desc: 'トップの所持金10%を没収し、他3人に均等分配します', effectColor: 'text-blue-400' },
  { id: 'basic_income', name: '🕊️ ベーシックインカム', desc: '全員の口座に一律500万Gが給付されます', effectColor: 'text-teal-400' },
  { id: 'inflation', name: '📈 インフレ', desc: 'ベットレートが強制的に3倍になります', effectColor: 'text-orange-500' }
];

const COIN_SOUND_URL = '/coin.mp3';
const BGM_URL = '/bgm.mp3';

const INITIAL_GAME_STATE = {
  playerCount: 4,
  playMode: 'digital', // 'digital' or 'physical'
  players: [],
  pot: 0,
  currentBetRequirement: 0, 
  phase: 'setup', 
  round: 1,
  historyLog: [],
  playerLogs: {},
  eventUsed: false,
  activeEvent: null,
  isTaxRiot: false,
  isRankRevolution: false,
  betMultiplier: 1,
  isCarryOver: false,
  deck: [],
  lastPlayedCards: [],
  turnIndex: 0,
  isGameRevolution: false,
  settings: {
    seEnabled: true,
    bgmEnabled: false,
  }
};

// =====================================
// ユーティリティ
// =====================================
function formatMoney(amount) {
  if (amount === 0) return '0';
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (absAmount >= 100_000_000) {
    const oku = Math.floor(absAmount / 100_000_000);
    const man = Math.floor((absAmount % 100_000_000) / 10000);
    if (man === 0) return `${sign}${oku}億`;
    return `${sign}${oku}億${man}万`;
  }
  if (absAmount >= 10000) return `${sign}${absAmount / 10000}万`;
  return amount.toLocaleString();
}

const roundToMillion = (amount) => Math.ceil(amount / 1000000) * 1000000;

function getPlayerCoords(position) {
  const coords = {
    'top-left': { x: '20vw', y: '20vh' },
    'top-center': { x: '50vw', y: '18vh' },
    'top-right': { x: '80vw', y: '20vh' },
    'bottom-left': { x: '20vw', y: '80vh' },
    'bottom-center': { x: '50vw', y: '82vh' },
    'bottom-right': { x: '80vw', y: '80vh' },
    'mid-left': { x: '18vw', y: '50vh' },
    'mid-right': { x: '82vw', y: '50vh' },
  };
  return coords[position] || { x: '50vw', y: '50vh' };
}

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// 人数に応じたランク構成を取得
const getRanksByCount = (count) => {
  if (count === 2) return [ALL_RANKS[0], ALL_RANKS[3]]; // 大富豪, 大貧民
  if (count === 3) return [ALL_RANKS[0], ALL_RANKS[4], ALL_RANKS[3]]; // 大富豪, 平民, 大貧民
  if (count === 4) return [ALL_RANKS[0], ALL_RANKS[1], ALL_RANKS[2], ALL_RANKS[3]]; // 大富豪, 富豪, 貧民, 大貧民
  if (count === 5) return [ALL_RANKS[0], ALL_RANKS[1], ALL_RANKS[4], ALL_RANKS[2], ALL_RANKS[3]]; // 大富豪, 富豪, 平民, 貧民, 大貧民
  if (count === 6) return [ALL_RANKS[0], ALL_RANKS[1], ALL_RANKS[4], ALL_RANKS[4], ALL_RANKS[2], ALL_RANKS[3]]; // 大富豪, 富豪, 平民x2, 貧民, 大貧民
  return [];
};

const getInitialState = (count = 4, mode = 'digital') => {
  const ranks = getRanksByCount(count);
  const shuffledRanks = shuffleArray(ranks);
  
  let positions = [];
  if (count === 2) positions = ['top-center', 'bottom-center'];
  else if (count === 3) positions = ['bottom-right', 'top-left', 'bottom-left'];
  else if (count === 4) positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  else if (count === 5) positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center'];
  else if (count === 6) positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'mid-left', 'mid-right'];

  
  const deck = shuffleDeck(createDeck());
  const hands = dealCards(deck, count);

  const players = Array.from({ length: count }).map((_, i) => ({
    id: `p${i+1}`,
    name: `プレイヤー${i+1}`,
    funds: INITIAL_FUNDS,
    currentBet: 0,
    currentRank: shuffledRanks[i],
    nextRankId: null,
    position: positions[i],
    hand: hands[i]
  }));

  return {
    ...INITIAL_GAME_STATE,
    playerCount: count,
    playMode: mode,
    players,
    phase: 'betting', // getInitialStateを呼んだ後はセットアップ完了なのでbettingへ
    playerLogs: players.reduce((acc, p) => ({ ...acc, [p.id]: [] }), {})
  };
};

// =====================================
// カード手札コンポーネント
// =====================================
function PlayerHand({ hand, onSelectCard, selectedCards }) {
  return (
    <div className="flex justify-center mt-2 px-4 py-2 overflow-x-auto no-scrollbar max-w-full">
      <div className="flex -space-x-4">
        {hand.map((card, i) => {
          const isSelected = selectedCards.some(c => c.id === card.id);
          const isRed = ['heart', 'diamond'].includes(card.suit);
          return (
            <div 
              key={card.id} 
              onClick={() => onSelectCard(card)}
              className={`w-10 h-14 bg-white rounded-md border-2 border-zinc-200 shadow-md flex flex-col items-center justify-between p-1 cursor-pointer transition-all duration-200 transform hover:scale-110 z-[${i}] ${isSelected ? '-translate-y-4 border-amber-500 ring-2 ring-amber-400/50' : ''}`}
            >
               <span className={`text-xs font-black self-start leading-none ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>{card.value}</span>
               <div className={`text-sm ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>
                 {card.suit === 'spade' && '♠️'}
                 {card.suit === 'heart' && '♥️'}
                 {card.suit === 'diamond' && '♦️'}
                 {card.suit === 'club' && '♣️'}
                 {card.suit === 'joker' && '🃏'}
               </div>
               <span className={`text-[10px] font-black self-end leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>{card.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =====================================
// プレイヤーパネルコンポーネント
// =====================================
function PlayerPanel({ 
  player, 
  gameState,
  availableRanks, 
  onAction,
  isTurn
}) {
  const [editingName, setEditingName] = useState(false);
  const [showRankSelect, setShowRankSelect] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);

  const toggleCard = (card) => {
    setSelectedCards(prev => 
      prev.some(c => c.id === card.id) 
        ? prev.filter(c => c.id !== card.id)
        : [...prev, card]
    );
  };

  const currentRequirement = gameState.currentBetRequirement;
  const playerBet = player.currentBet;
  const diff = currentRequirement - playerBet;

  const isActuallyTop = gameState.playerCount === 2 ? player.id === 'p1' : (player.position || '').includes('top');
  const isRight = (player.position || '').includes('right');

  const selectedRank = ALL_RANKS.find(r => r.id === player.nextRankId);
  const rotationClass = isActuallyTop ? 'rotate-180' : '';
  const borderColor = player.currentRank ? player.currentRank.borderClass : 'border-zinc-700';
  const headerBg = player.currentRank ? player.currentRank.bgClass : 'bg-zinc-800';
  const headerText = player.currentRank ? player.currentRank.textClass : 'text-amber-400';

  const callAmount = Math.max(0, gameState.currentBetRequirement - player.currentBet);
  const myLogs = gameState.playerLogs[player.id] || [];
  const unit = BET_UNIT;

  const getActualCost = (baseAmount) => {
    if (!gameState.isRankRevolution) return baseAmount;
    if (player.currentRank?.id === 1) return baseAmount * 2;
    if (player.currentRank?.id === 4) return baseAmount * 0.5;
    return baseAmount;
  };

  return (
    <div className={`flex flex-col h-full w-full rounded-2xl shadow-2xl overflow-visible border-[3px] transition-all duration-500 relative ${isTurn ? 'border-amber-400 neon-box-gold scale-105 z-40' : 'border-white/10 opacity-70 bg-zinc-900/80 backdrop-blur-md'}`}>
      <div className={`${headerBg} px-3 py-2 flex items-center ${isRight ? 'flex-row-reverse justify-start' : 'justify-start'} gap-3 shadow-md z-10 border-b border-black/50`}>
        <div className="shrink-0 min-w-0">
          {editingName ? (
            <input
              autoFocus
              type="text"
              value={player.name}
              onChange={e => onAction('UPDATE_NAME', { playerId: player.id, name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              className={`font-bold text-base bg-white/50 rounded px-2 py-0.5 w-32 outline-none text-black`}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className={`font-black text-lg truncate ${headerText} opacity-90 hover:opacity-100 transition-opacity ${isRight ? 'text-right' : 'text-left'} drop-shadow-md`}
            >
              {player.name}
            </button>
          )}
        </div>

        {player.currentRank && <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${player.currentRank.bgClass} ${player.currentRank.textClass} border ${player.currentRank.borderClass}`}>{player.currentRank.icon} {player.currentRank.name}</div>}

        {gameState.activeEvent && (
          <div className="flex-1 overflow-hidden flex items-center h-7 bg-black/60 rounded-md border border-white/10 shadow-inner">
            <div className="animate-marquee whitespace-nowrap px-3 flex items-center gap-3">
              <span className={`text-sm font-black ${gameState.activeEvent.effectColor} drop-shadow-md`}>
                {gameState.activeEvent.name}
              </span>
              <span className="text-xs text-zinc-300 font-black">
                {gameState.activeEvent.desc}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-2 relative z-10">
        <div className="text-amber-500/80 text-[10px] font-black tracking-widest mb-1"><Banknote size={12} className="inline mr-1" />TOTAL FUNDS</div>
        <div className={`text-4xl font-black tracking-tighter leading-none mb-1 drop-shadow-xl ${player.funds > INITIAL_FUNDS ? 'text-amber-400 neon-text-gold' : player.funds < 0 ? 'text-red-500 font-bold' : player.funds < INITIAL_FUNDS ? 'text-red-400' : 'text-zinc-100'}`}>
          {formatMoney(player.funds)} <span className="text-lg opacity-70">G</span>
        </div>

        {gameState.playMode === 'digital' && <PlayerHand hand={player.hand || []} onSelectCard={toggleCard} selectedCards={selectedCards} />}
        
        <div className="flex items-center gap-4 mt-8 h-20 w-full justify-center relative">
          {player.currentBet > 0 && (
            <div className="flex gap-1.5 items-end h-full">
              {Array.from({ length: Math.ceil(player.currentBet / (BET_UNIT * 10)) }).map((_, colIndex) => {
                const countInCol = Math.min(10, Math.floor(player.currentBet / BET_UNIT) - colIndex * 10);
                if (countInCol <= 0) return null;
                return (
                  <div key={colIndex} className="relative w-12 h-full flex-shrink-0">
                    {Array.from({ length: countInCol }).map((_, i) => (
                      <img 
                        key={i} 
                        src="/chip/5.svg" 
                        alt="chip"
                        className="absolute w-12 h-auto drop-shadow-lg" 
                        style={{ bottom: `${i * 3}px`, zIndex: i }} 
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {player.currentBet > 0 && (
            <div className="bg-black/60 rounded-full px-3 py-1.5 flex flex-col items-center border border-amber-500/30 neon-box-gold z-50">
              <span className="text-[9px] text-zinc-400 font-bold leading-tight">現在のベット</span>
              <span className="text-base text-amber-400 font-black leading-tight">{formatMoney(player.currentBet)} G</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center justify-center pointer-events-none mt-1 min-h-[30px] w-full">
          {myLogs.map((log, i) => (
            <div key={log.id} className={`text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm shadow-sm transition-opacity duration-1000 ${i === 0 ? 'text-white bg-black/60 opacity-100 mb-0.5' : 'text-zinc-400 bg-transparent opacity-50 text-[9px]'}`}>{log.text}</div>
          ))}
        </div>
      </div>

      <div className="bg-black/80 border-t-2 border-red-900 p-2 min-h-[105px] flex-shrink-0 flex flex-col justify-center gap-2 z-10">
        {selectedRank ? (
          <button onClick={() => onAction('CANCEL_RANK', { playerId: player.id })} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-black shadow-lg active:scale-95 transition-transform bg-zinc-800 text-white border-2 border-white/30`}>
            <span className="drop-shadow-md">{selectedRank.id}着であがり！</span>
            <span className="flex items-center gap-1 text-xs opacity-90 bg-black/50 px-2 py-1 rounded-lg"><Undo2 size={12} /> 取消</span>
          </button>
        ) : showRankSelect ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="grid grid-cols-2 gap-1">
              {availableRanks.map(rank => (
                <button key={rank.id} onClick={() => onAction('SELECT_RANK', { playerId: player.id, rankId: rank.id })} className={`py-3 rounded-lg font-black text-[10px] transition-all border ${rank.bgClass} ${rank.textClass} ${rank.borderClass} ${player.nextRankId === rank.id ? 'ring-4 ring-white scale-105 z-10 shadow-xl' : 'opacity-60'}`}>{rank.icon} {rank.name}</button>
              ))}
            </div>
            <button onClick={() => setShowRankSelect(false)} className="text-zinc-400 text-xs py-1 hover:text-white font-bold">キャンセル</button>
          </div>
        ) : gameState.playMode === 'physical' ? (
          <div className="flex flex-col gap-2 w-full">
             <div className="text-[10px] text-zinc-500 font-bold text-center uppercase tracking-tighter">着順を記録してください</div>
             <div className="grid grid-cols-2 gap-1">
              {availableRanks.map(rank => (
                <button key={rank.id} onClick={() => onAction('SELECT_RANK', { playerId: player.id, rankId: rank.id })} className={`py-3 rounded-lg font-black text-[10px] transition-all border ${rank.bgClass} ${rank.textClass} ${rank.borderClass} ${player.nextRankId === rank.id ? 'ring-4 ring-white scale-105 z-10 shadow-xl' : 'opacity-60'}`}>{rank.icon} {rank.name}</button>
              ))}
            </div>
          </div>
        ) : gameState.phase === 'pot_claim' ? (
          <div className="flex flex-col gap-2 w-full">
            <button onClick={() => onAction('CLAIM_POT', { playerId: player.id })} className="w-full py-3 rounded-xl font-black text-amber-950 bg-gradient-to-b from-amber-300 to-amber-500 hover:brightness-110 active:scale-95 transition-all shadow-xl animate-pulse flex items-center justify-center gap-2 border border-amber-200 neon-box-gold"><Gem size={18} />💰 ポット総取り</button>
            <button onClick={() => onAction('CANCEL_POT_CLAIM', { playerId: player.id })} className="w-full py-1.5 rounded-lg font-bold text-zinc-400 hover:text-white transition-colors text-[10px]">キャンセルして戻る</button>
          </div>
        ) : gameState.phase === 'tax_collection' ? (
          <div className="text-center text-amber-500 text-xs font-black animate-pulse py-4">💸 税金徴収中... 💸</div>
        ) : (
          <div className="flex flex-col gap-2">
            {selectedCards.length > 0 && (
              <div className="flex gap-2">
                <button onClick={() => { onAction('PLAY_CARDS', { playerId: player.id, cards: selectedCards }); setSelectedCards([]); }} className="flex-[2] py-3 rounded-xl font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 border border-emerald-400">
                  <Layers size={18} /> 出す
                </button>
                <button onClick={() => onAction('PASS_TURN', { playerId: player.id })} className="flex-1 py-3 rounded-xl font-black text-zinc-400 bg-zinc-800 border border-zinc-700 active:scale-95 transition-all">パス</button>
              </div>
            )}
            
            {currentRequirement === 0 && !isOpening ? (
              <button onClick={() => setIsOpening(true)} className="w-full py-4 rounded-xl font-black text-xl text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:brightness-110 active:scale-95 transition-all shadow-xl border border-white/20 flex items-center justify-center gap-2">
                <ScrollText size={24} /> 🎴 カードを出す
              </button>

            ) : currentRequirement > 0 && playerBet < currentRequirement ? (
              <div className="flex gap-1 h-14">
                <button onClick={() => onAction('BET', { playerId: player.id, amount: diff })} className="flex-[3] rounded-lg font-black text-sm bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 border border-amber-300 shadow-lg active:scale-95 transition-all flex flex-col items-center justify-center">
                  <span className="text-[10px] opacity-80">差額を払う</span>
                  <span>{formatMoney(diff)} G</span>
                </button>
                <button onClick={() => onAction('PASS', { playerId: player.id })} className="flex-1 rounded-lg font-black text-xs bg-zinc-900 text-zinc-500 border border-zinc-700">降りる(パス)</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-1 h-12">
                  <button onClick={() => { onAction('BET', { playerId: player.id, amount: unit * 1 }); setIsOpening(false); }} className="flex-1 rounded-lg font-black text-xs bg-zinc-800 text-amber-400 border border-zinc-600">100万</button>
                  <button onClick={() => { onAction('BET', { playerId: player.id, amount: unit * 5 }); setIsOpening(false); }} className="flex-1 rounded-lg font-black text-xs bg-zinc-800 text-amber-400 border border-zinc-600">500万</button>
                  <button onClick={() => { onAction('BET', { playerId: player.id, amount: unit * 10 }); setIsOpening(false); }} className="flex-1 rounded-lg font-black text-xs bg-red-900 text-amber-400 border border-red-700">1000万</button>
                  <button onClick={() => { onAction('PASS', { playerId: player.id }); setIsOpening(false); }} className="flex-1 rounded-lg font-black text-xs bg-zinc-900 text-zinc-500 border border-zinc-700">降りる(パス)</button>
                </div>
                {isOpening ? (
                  <button onClick={() => setIsOpening(false)} className="w-full py-1 text-[10px] text-zinc-500 font-bold hover:text-white transition-colors">キャンセル</button>
                ) : (
                  <button onClick={() => setShowRankSelect(true)} className="w-full py-2 rounded-lg font-black text-xs text-amber-500 bg-black/50 border border-amber-900">🚩 あがり宣言</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================
// セットアップ画面
// =====================================
function SetupScreen({ onStart }) {
  const [count, setCount] = useState(4);
  const [mode, setMode] = useState('digital');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-[500px] p-8 rounded-3xl bg-zinc-900 border-4 border-amber-500 shadow-2xl neon-box-gold text-center">
        <h1 className="text-4xl font-black text-amber-500 mb-8 tracking-tighter">DAIFUGO TRACKER</h1>
        
        <div className="mb-8">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 block">プレイヤー人数</label>
          <div className="flex justify-center gap-2">
            {[2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => setCount(n)} className={`w-12 h-12 rounded-xl font-black text-lg transition-all ${count === n ? 'bg-amber-500 text-amber-950 scale-110 shadow-lg' : 'bg-zinc-800 text-zinc-500'}`}>{n}</button>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 block">プレイモード</label>
          <div className="flex gap-4">
            <button onClick={() => setMode('digital')} className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${mode === 'digital' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-600'}`}>
              <Layers size={32} />
              <div className="font-black text-sm">デジタル</div>
              <div className="text-[10px] opacity-70">アプリでカード配布</div>
            </button>
            <button onClick={() => setMode('physical')} className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${mode === 'physical' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-600'}`}>
              <Hand size={32} />
              <div className="font-black text-sm">リアルカード</div>
              <div className="text-[10px] opacity-70">実際のトランプを使用</div>
            </button>
          </div>
        </div>

        <button onClick={() => onStart(count, mode)} className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 text-amber-950 font-black text-xl shadow-xl active:scale-95 transition-all border-b-4 border-amber-800">
          ゲームスタート
        </button>
      </div>
    </div>
  );
}

// =====================================
// メインアプリ
// =====================================
export default function App() {
  const [gameState, setGameState] = useState(() => {
    const saved = localStorage.getItem('daifugo_tracker_v1');
    if (!saved) return getInitialState(4);
    try {
      const parsed = JSON.parse(saved);
      // カードゲーム機能追加後の必須データ（deckや各プレイヤーのhand）があるかチェック
      const isLegacy = !parsed.deck || parsed.players.some(p => !p.hand);
      if (isLegacy) return getInitialState(parsed.playerCount || 4);
      // positionがない場合に補完
      parsed.players = parsed.players.map((p, i) => {
        if (!p.position) {
          const tempPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'mid-left', 'mid-right'];
          return { ...p, position: tempPositions[i % tempPositions.length] || 'bottom-center' };
        }
        return p;
      });
      return parsed;
    } catch (e) {
      return getInitialState(4);
    }
  });
  
  const [history, setHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempPlayerCount, setTempPlayerCount] = useState(4);
  
  const [particles, setParticles] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinEvent, setSpinEvent] = useState(null);

  const coinAudio = useRef(null);
  const bgmAudio = useRef(null);

  useEffect(() => {
    coinAudio.current = new Audio(COIN_SOUND_URL);
    bgmAudio.current = new Audio(BGM_URL);
    bgmAudio.current.loop = true;
    bgmAudio.current.volume = 0.3;
  }, []);

  useEffect(() => {
    localStorage.setItem('daifugo_tracker_v1', JSON.stringify(gameState));
    if (bgmAudio.current) {
      if (gameState.settings.bgmEnabled) bgmAudio.current.play().catch(() => {});
      else bgmAudio.current.pause();
    }
  }, [gameState]);

  const playCoinSound = useCallback(() => {
    if (gameState.settings.seEnabled && coinAudio.current) {
      coinAudio.current.currentTime = 0;
      coinAudio.current.play().catch(() => {});
    }
  }, [gameState.settings.seEnabled]);

  const showPopup = useCallback((position, amount) => {
    if (amount === 0) return;
    playCoinSound();
    const id = Date.now() + Math.random();
    setFloatingTexts(prev => [...prev, { id, position, amount }]);
    setTimeout(() => { setFloatingTexts(prev => prev.filter(t => t.id !== id)); }, 1500);
  }, [playCoinSound]);

  const updateState = useCallback((updater, logsToAdd = []) => {
    setHistory(prev => [...prev, gameState]);
    setGameState(prev => {
      let nextState = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (logsToAdd.length > 0) {
        let nextLogs = { ...nextState.playerLogs };
        logsToAdd.forEach(log => {
          if (log.playerId) {
            nextLogs[log.playerId] = [{ id: Date.now() + Math.random(), text: log.text }, ...(nextLogs[log.playerId] || [])].slice(0, 3);
          }
        });
        nextState = { ...nextState, playerLogs: nextLogs };
      }
      return nextState;
    });
  }, [gameState]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setGameState(previousState);
  }, [history]);

  const handleAction = useCallback((type, payload) => {
    let logsToAdd = [];
    updateState(prev => {
      const newState = { ...prev, players: [...prev.players] };
      const playerIndex = prev.players.findIndex(p => p.id === payload.playerId);
      const player = { ...newState.players[playerIndex] };

      switch (type) {
        case 'PLAY_CARDS': {
          const cards = payload.cards;
          if (canPlayCards(newState.lastPlayedCards, cards, newState.isGameRevolution)) {
            player.hand = player.hand.filter(c => !cards.some(sc => sc.id === c.id));
            newState.lastPlayedCards = cards;
            newState.players[playerIndex] = player;
            newState.turnIndex = (newState.turnIndex + 1) % newState.playerCount;
            logsToAdd.push({ playerId: player.id, text: `カードを出しました (${cards.length}枚)` });
            
            // あがり判定
            if (player.hand.length === 0) {
              const finishCount = newState.players.filter(p => p.nextRankId !== null).length;
              const rankId = finishCount + 1;
              const declaredRank = ALL_RANKS.find(r => r.id === rankId);
              let reward = declaredRank ? declaredRank.reward : 0;
              if (newState.isRankRevolution) {
                if (rankId === 1) reward = -10_000_000;
                else if (rankId === 4) reward = 20_000_000;
              }
              player.funds += reward;
              player.nextRankId = rankId;
              showPopup(player.position, reward);
              logsToAdd.push({ playerId: player.id, text: `✨ あがり！ ${rankId}着 (+${formatMoney(reward)}G)` });
            }
          }
          break;
        }
        case 'PASS_TURN': {
          newState.turnIndex = (newState.turnIndex + 1) % newState.playerCount;
          // 全員パスして場が流れるロジックは簡略化
          logsToAdd.push({ playerId: player.id, text: `パス` });
          break;
        }
        case 'UPDATE_NAME':
          player.name = payload.name;
          newState.players[playerIndex] = player;
          break;
        case 'BET':
          let actualCost = payload.amount;
          player.funds -= actualCost;
          player.currentBet += payload.amount;
          newState.pot += payload.amount;
          if (player.currentBet > newState.currentBetRequirement) {
            newState.currentBetRequirement = player.currentBet;
          }
          newState.players[playerIndex] = player;
          showPopup(player.position, -actualCost);
          spawnParticles(getPlayerCoords(player.position), { x: '50vw', y: '50vh' }, 3);
          logsToAdd.push({ playerId: player.id, text: `ベット ${formatMoney(payload.amount)}G` });
          break;
        case 'CLAIM_POT':
          const claimedAmount = newState.pot;
          player.funds += claimedAmount;
          newState.pot = 0; newState.currentBetRequirement = 0;
          newState.players = newState.players.map(p => ({ ...p, currentBet: 0 }));
          newState.players[playerIndex] = player;
          newState.phase = 'betting';
          showPopup(player.position, claimedAmount);
          spawnParticles({ x: '50vw', y: '50vh' }, getPlayerCoords(player.position), 5);
          logsToAdd.push({ playerId: player.id, text: `ポット総取り！ +${formatMoney(claimedAmount)}G` });
          break;
        case 'SELECT_RANK': {
          player.nextRankId = payload.rankId;
          const declaredRank = ALL_RANKS.find(r => r.id === payload.rankId);
          let reward = declaredRank.reward;
          if (newState.isRankRevolution) {
            if (declaredRank.id === 1) reward = -10_000_000;
            else if (declaredRank.id === 4) reward = 20_000_000;
          }
          player.funds += reward;
          newState.players[playerIndex] = player;
          showPopup(player.position, reward);
          logsToAdd.push({ playerId: player.id, text: `${payload.rankId}着であがり (+${formatMoney(reward)}G)` });
          break;
        }
        case 'CANCEL_RANK': {
          const declaredRank = ALL_RANKS.find(r => r.id === player.nextRankId);
          if (declaredRank) {
            let reward = declaredRank.reward;
            if (newState.isRankRevolution) {
              if (declaredRank.id === 1) reward = -10_000_000;
              else if (declaredRank.id === 4) reward = 20_000_000;
            }
            player.funds -= reward;
            showPopup(player.position, -reward);
          }
          player.nextRankId = null;
          newState.players[playerIndex] = player;
          logsToAdd.push({ playerId: player.id, text: `宣言をキャンセル` });
          break;
        }
        case 'CANCEL_POT_CLAIM':
          newState.phase = 'betting';
          logsToAdd.push({ text: `場を流すをキャンセル` });
          break;
        case 'PASS':
          player.currentBet = 0;
          newState.players[playerIndex] = player;
          logsToAdd.push({ playerId: player.id, text: `降りる（パス）` });
          break;
        case 'RUN_EVENT': {
          const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
          const logs = [{ text: `🎲 イベント発生: ${event.name}` }];
          
          let newState = { ...gameState, activeEvent: event, eventUsed: true };

          if (event.id === 'revolution') {
            newState.isGameRevolution = !newState.isGameRevolution;
          }
          
          updateState(newState, logs);
          break;
        }
      }
      return newState;
    }, logsToAdd);
  }, [updateState, showPopup]);

  const spawnParticles = (start, end, count) => {
    const newParticles = Array.from({ length: count }).map((_, i) => ({
      id: Date.now() + Math.random(), startX: start.x, startY: start.y, endX: end.x, endY: end.y, delay: i * 100,
    }));
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => { setParticles(prev => prev.filter(p => !newParticles.find(n => n.id === p.id))); }, 1500);
  };

  const passAndClearBoard = () => {
    updateState(prev => {
      const resetPlayers = prev.players.map(p => ({ ...p, currentBet: 0 }));
      if (prev.isCarryOver) return { ...prev, currentBetRequirement: 0, players: resetPlayers, isCarryOver: false };
      return { ...prev, phase: 'pot_claim', currentBetRequirement: 0, players: resetPlayers };
    });
  };

  const commitRound = () => {
    let logsToAdd = [];
    updateState(prev => {
      const activeRanks = getRanksByCount(prev.playerCount);
      const playersWithRewards = prev.players.map(p => ({ ...p, nextRankId: null, currentBet: 0 }));

      // 報酬は既にあがり宣言時に加算済みなので、所持金でソートして役職を決めるだけ
      const sortedByFunds = [...playersWithRewards].sort((a, b) => b.funds - a.funds);
      
      const newPlayers = playersWithRewards.map(p => {
        const finalRankIndex = sortedByFunds.findIndex(sp => sp.id === p.id);
        const nextRank = activeRanks[finalRankIndex];
        logsToAdd.push({ playerId: p.id, text: `最終順位 ${finalRankIndex + 1}位 -> ${nextRank.icon}${nextRank.name}` });
        return { ...p, currentRank: nextRank };
      });

      return { ...prev, players: newPlayers, pot: 0, currentBetRequirement: 0, phase: 'tax_collection', round: prev.round, historyLog: [...prev.historyLog, { round: prev.round, results: [] }] };
    }, logsToAdd);
  };

  const executeTaxCollection = () => {
    let logsToAdd = [];
    updateState(prev => {
      let players = [...prev.players];
      const isRev = prev.isTaxRiot;
      const taxReceiver1 = players.find(p => p.currentRank?.id === (isRev ? 4 : 1));
      const taxReceiver2 = players.find(p => p.currentRank?.id === (isRev ? 3 : 2));
      let r1Gain = 0; let r2Gain = 0;
      players = players.map(p => {
        let paid = 0;
        if (taxReceiver1 && p.currentRank?.id !== taxReceiver1.currentRank.id) {
          const t = roundToMillion(p.funds * 0.20); paid += t; r1Gain += t;
          spawnParticles(getPlayerCoords(p.position), getPlayerCoords(taxReceiver1.position), 3);
        }
        if (taxReceiver2 && (p.currentRank?.id === 3 || p.currentRank?.id === 4)) {
          const t = roundToMillion(p.funds * 0.10); paid += t; r2Gain += t;
          spawnParticles(getPlayerCoords(p.position), getPlayerCoords(taxReceiver2.position), 2);
        }
        if (paid > 0) { showPopup(p.position, -paid); logsToAdd.push({ playerId: p.id, text: `税金支払い -${formatMoney(paid)}G` }); }
        return { ...p, funds: p.funds - paid };
      });
      players = players.map(p => {
        if (p.id === taxReceiver1?.id) return { ...p, funds: p.funds + r1Gain };
        if (p.id === taxReceiver2?.id) return { ...p, funds: p.funds + r2Gain };
        return p;
      });
      return { ...prev, players, round: prev.round + 1, phase: 'betting', eventUsed: false, activeEvent: null, isTaxRiot: false, isRankRevolution: false, betMultiplier: 1, isCarryOver: false };
    }, logsToAdd);
  };

  const runRandomEvent = () => {
    setIsSpinning(true);
    let count = 0;
    const interval = setInterval(() => {
      playCoinSound();
      setSpinEvent(RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)]);
      if (++count > 20) {
        clearInterval(interval); setIsSpinning(false);
        const final = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        setSpinEvent(final); applyEvent(final); setTimeout(() => setSpinEvent(null), 3000);
      }
    }, 100);
  };

  const applyEvent = (event) => {
    let logsToAdd = [];
    updateState(prev => {
      let next = { ...prev, eventUsed: true, activeEvent: event };
      if (event.id === 'riot') next.isTaxRiot = true;
      else if (event.id === 'inflation') next.betMultiplier = 3;
      else if (event.id === 'carry_over') next.isCarryOver = true;
      else if (event.id === 'revolution_money') next.isRankRevolution = true;
      else if (event.id === 'fall_of_king') {
        let t = next.players.find(p => p.currentRank?.id === 1) || [...next.players].sort((a,b)=>b.funds-a.funds)[0];
        showPopup(t.position, -10_000_000); next.players = next.players.map(p => p.id === t.id ? { ...p, funds: p.funds - 10_000_000 } : p);
        next.pot += 10_000_000; logsToAdd.push({ playerId: t.id, text: `トップ没落！ -1000万G` });
      }
      else if (event.id === 'basic_income') {
        next.players = next.players.map(p => { showPopup(p.position, 5_000_000); return { ...p, funds: p.funds + 5_000_000 }; });
      }
      else if (event.id === 'redistribution') {
        let top = [...next.players].sort((a,b)=>b.funds-a.funds)[0];
        const tax = roundToMillion(top.funds * 0.10); const share = roundToMillion(tax / (next.playerCount-1));
        showPopup(top.position, -tax);
        next.players = next.players.map(p => {
          if (p.id === top.id) return { ...p, funds: p.funds - tax };
          showPopup(p.position, share); return { ...p, funds: p.funds + share };
        });
      }
      return next;
    }, logsToAdd);
  };

  const resetGame = (count, mode) => { localStorage.removeItem('daifugo_tracker_v1'); setHistory([]); setGameState(getInitialState(count, mode)); setShowResetConfirm(false); };

  const activeRanks = getRanksByCount(gameState.playerCount);
  const availableRanks = activeRanks.filter(rank => !gameState.players.some(p => p.nextRankId === rank.id));
  const isAllRanked = gameState.players.every(p => p.nextRankId !== null);

  return (
    <div className="fixed inset-0 bg-black font-sans overflow-hidden select-none">
      {gameState.phase === 'setup' && (
        <SetupScreen onStart={(count, mode) => {
          setGameState(getInitialState(count, mode));
        }} />
      )}

      <div className="fixed inset-0 pointer-events-none z-50">
        {particles.map(p => (
          <div key={p.id} className="absolute money-particle drop-shadow-xl" style={{ left: p.startX, top: p.startY, transform: 'translate(-50%, -50%)', width: '32px' }} ref={el => { if (el) setTimeout(() => { el.style.left = p.endX; el.style.top = p.endY; el.style.transform = 'translate(-50%, -50%) scale(0.5) rotate(360deg)'; el.style.opacity = '0'; }, p.delay + 50); }}>
            <img src="/chip/5.svg" alt="chip" className="w-full h-auto" />
          </div>
        ))}
        {floatingTexts.map(t => {
          const coords = getPlayerCoords(t.position); const isPlus = t.amount > 0;
          return (
            <div key={t.id} className={`absolute animate-float-up text-4xl font-black drop-shadow-xl px-4 py-2 rounded-xl backdrop-blur-sm ${isPlus ? 'text-emerald-400 bg-emerald-950/50' : 'text-red-500 bg-red-950/50'}`} style={{ left: coords.x, top: coords.y, transform: 'translate(-50%, -50%)' }}>
              {isPlus ? '+' : ''}{formatMoney(t.amount)}G
            </div>
          );
        })}
      </div>

      <div className="absolute inset-0 bg-velvet opacity-60 pointer-events-none" />
      
      {/* 革命中アナウンス */}
      {gameState.isGameRevolution && (
        <div className="absolute top-[12%] left-1/2 -translate-x-1/2 z-[60] animate-pulse pointer-events-none">
          <div className="bg-rose-600/90 text-white px-8 py-3 rounded-full font-black text-2xl shadow-2xl border-4 border-white neon-box-gold flex items-center gap-2">
             <Layers className="rotate-180" /> ⚔️ 革命中！
          </div>
        </div>
      )}

      <div className="relative z-30 w-full h-full pointer-events-none">
        {(gameState.players || []).map((player, index) => {
          const coords = getPlayerCoords(player.position) || { x: '50vw', y: '50vh' };
          const isTurn = gameState.turnIndex === index;
          return (
            <div 
              key={player.id || index} 
              className="absolute transition-all duration-500 pointer-events-auto"
              style={{ 
                left: coords.x, 
                top: coords.y, 
                transform: 'translate(-50%, -50%)',
                width: gameState.playerCount > 4 ? '220px' : '300px',
                minHeight: '350px',
              }}
            >
              <div className={`w-full h-full scale-[0.85] md:scale-100 transition-transform`}>
                <PlayerPanel player={player} gameState={gameState} availableRanks={availableRanks || []} onAction={handleAction} isTurn={isTurn} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <div className="w-[240px] h-[240px] md:w-[300px] md:h-[300px] rounded-full bg-black border-4 border-amber-500 neon-box-gold shadow-2xl flex flex-col items-center justify-center relative pointer-events-auto scale-90 md:scale-100">
          {/* 場に出ているカード */}
          <div className="absolute -top-12 flex -space-x-4 animate-bounce-subtle">
            {gameState.lastPlayedCards.map((card, i) => {
              const isRed = ['heart', 'diamond'].includes(card.suit);
              return (
                <div key={i} className="w-14 h-20 bg-white rounded-lg border-2 border-amber-500 shadow-2xl flex flex-col items-center justify-between p-1">
                   <span className={`text-xs font-black self-start leading-none ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>{card.value}</span>
                   <div className={`text-lg ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>
                     {card.suit === 'spade' && '♠️'}
                     {card.suit === 'heart' && '♥️'}
                     {card.suit === 'diamond' && '♦️'}
                     {card.suit === 'club' && '♣️'}
                     {card.suit === 'joker' && '🃏'}
                   </div>
                   <span className={`text-[10px] font-black self-end leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-zinc-900'}`}>{card.value}</span>
                </div>
              );
            })}
          </div>
          {gameState.phase === 'betting' && (
            <button onClick={runRandomEvent} className="absolute top-2 left-4 text-indigo-400 hover:text-white p-2 rounded-full z-30 flex flex-col items-center gap-0.5"><Dices size={20} /><span className="text-[8px] font-black">EVENT</span></button>
          )}
          <button onClick={() => setShowHistoryModal(true)} className="absolute top-2 right-4 text-amber-500 hover:text-white p-2 rounded-full z-30 flex flex-col items-center gap-0.5"><History size={18} /><span className="text-[8px] font-black">LOG</span></button>
          <div className="flex flex-col items-center mt-3 w-full px-4 z-20">
            <div className="text-amber-500 text-[10px] font-black neon-text-gold mb-1">ROUND {gameState.round}</div>
            {gameState.phase !== 'tax_collection' && (
              <div className={`bg-red-950/80 rounded-xl px-4 py-2 flex flex-col items-center w-full border border-amber-500/50 mb-1 ${gameState.isCarryOver ? 'border-emerald-500 animate-pulse' : ''}`}>
                {gameState.pot > 0 && (
                  <div className="flex gap-1 items-end h-10 mb-2 max-w-full overflow-hidden">
                    {Array.from({ length: Math.ceil(gameState.pot / (BET_UNIT * 10)) }).slice(0, 8).map((_, colIndex) => {
                      const countInCol = Math.min(10, Math.floor(gameState.pot / BET_UNIT) - colIndex * 10);
                      return (
                        <div key={colIndex} className="relative w-8 h-full flex-shrink-0">
                          {Array.from({ length: countInCol }).map((_, i) => (
                            <img key={i} src="/chip/5.svg" className="absolute w-8 h-auto" style={{ bottom: `${i * 2}px`, zIndex: i }} />
                          ))}
                        </div>
                      );
                    })}
                    {gameState.pot > BET_UNIT * 80 && <span className="text-white text-[8px] font-bold self-center ml-1">...</span>}
                  </div>
                )}
                <span className="text-[10px] text-amber-400 font-bold">💰 POT</span>
                <span className="text-3xl font-black text-amber-300 neon-text-gold">{formatMoney(gameState.pot)}</span>
              </div>
            )}
            {gameState.phase === 'betting' && !isAllRanked && (
              <div className="text-center w-full mt-2">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Wager Input Mode</span>
              </div>
            )}
          </div>
          <div className="absolute bottom-4 flex justify-center w-full px-5 z-30">
            {gameState.phase === 'tax_collection' ? (
              <button onClick={executeTaxCollection} className="w-full bg-red-700 text-white py-2 rounded-full font-black text-xs animate-pulse">税金徴収 <ChevronRight size={14} className="inline"/></button>
            ) : isAllRanked ? (
              <button onClick={commitRound} className="w-full bg-amber-500 text-amber-950 py-2 rounded-full font-black text-xs animate-pulse">精算 <ChevronRight size={14} className="inline"/></button>
            ) : (
              <button onClick={passAndClearBoard} className="w-full bg-zinc-800 text-amber-500 py-2 rounded-full font-bold text-xs">{gameState.isCarryOver ? "次へ" : "🌊 場を流す"}</button>
            )}
          </div>
        </div>
      </div>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        <button onClick={undo} className="p-3 rounded-xl bg-black/80 border border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-black transition-all flex flex-col items-center gap-1 shadow-lg" title="一手戻す">
          <Undo2 size={24} />
          <span className="text-[10px] font-black">UNDO</span>
        </button>
        <button onClick={() => setShowSettingsModal(true)} className="p-3 rounded-xl bg-black/80 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"><Settings size={24} /></button>
        <button onClick={() => setShowResetConfirm(true)} className="p-3 rounded-xl bg-black/80 border border-zinc-800 text-zinc-600 hover:text-red-500 transition-colors"><RotateCcw size={18} /></button>
      </div>

      {showResetConfirm && (
        <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center backdrop-blur-md">
          <div className="bg-zinc-900 border-4 border-amber-500 rounded-3xl p-8 w-[500px] text-center shadow-2xl neon-box-gold">
            <h3 className="text-white font-black text-2xl mb-8 tracking-tighter">新規ゲーム設定 / リセット</h3>
            
            <div className="mb-8">
              <label className="text-zinc-500 font-bold text-xs block mb-4 uppercase tracking-widest">プレイヤー人数</label>
              <div className="flex justify-center gap-2">
                {[2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => setTempPlayerCount(n)} className={`w-12 h-12 rounded-xl font-black text-lg transition-all ${tempPlayerCount === n ? 'bg-amber-500 text-amber-950 scale-110 shadow-lg' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>{n}</button>
                ))}
              </div>
            </div>

            <div className="mb-10">
              <label className="text-zinc-500 font-bold text-xs block mb-4 uppercase tracking-widest">プレイモード</label>
              <div className="flex gap-4">
                <button onClick={() => updateState({ playMode: 'digital' })} className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${gameState.playMode === 'digital' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-600'}`}>
                  <Layers size={24} />
                  <div className="font-black text-xs">デジタル</div>
                </button>
                <button onClick={() => updateState({ playMode: 'physical' })} className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${gameState.playMode === 'physical' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 bg-zinc-800/50 text-zinc-600'}`}>
                  <Hand size={24} />
                  <div className="font-black text-xs">リアルカード</div>
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-4 rounded-xl font-bold text-zinc-400 bg-zinc-800 border border-zinc-700">キャンセル</button>
              <button onClick={() => resetGame(tempPlayerCount, gameState.playMode)} className="flex-[2] py-4 rounded-xl font-black text-white bg-gradient-to-r from-red-600 to-rose-700 shadow-xl border-b-4 border-red-900 active:scale-95 transition-all">
                設定を反映してリセット
              </button>
            </div>
          </div>
        </div>
      )}
      {showSettingsModal && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center backdrop-blur-md">
          <div className="bg-zinc-900 border border-amber-500/50 rounded-3xl p-8 w-80 shadow-2xl relative">
            <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24} /></button>
            <h3 className="text-amber-500 font-black text-xl mb-6 flex items-center gap-2"><Settings /> 音声設定</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold"><Volume2 size={20} /> SE</div>
                <button onClick={() => setGameState(p => ({ ...p, settings: { ...p.settings, seEnabled: !p.settings.seEnabled } }))} className={`w-14 h-8 rounded-full relative transition-colors ${gameState.settings.seEnabled ? 'bg-amber-500' : 'bg-zinc-700'}`}><div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${gameState.settings.seEnabled ? 'left-7' : 'left-1'}`} /></button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold"><Music size={20} /> BGM</div>
                <button onClick={() => setGameState(p => ({ ...p, settings: { ...p.settings, bgmEnabled: !p.settings.bgmEnabled } }))} className={`w-14 h-8 rounded-full relative transition-colors ${gameState.settings.bgmEnabled ? 'bg-amber-500' : 'bg-zinc-700'}`}><div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${gameState.settings.bgmEnabled ? 'left-7' : 'left-1'}`} /></button>
              </div>
            </div>
            <button onClick={() => setShowSettingsModal(false)} className="w-full mt-8 py-3 rounded-xl font-bold text-amber-950 bg-amber-500">閉じる</button>
          </div>
        </div>
      )}

      {(isSpinning || (spinEvent && gameState.activeEvent === spinEvent)) && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
          <div className="relative bg-black/80 border-2 border-indigo-500 p-8 rounded-3xl shadow-[0_0_50px_rgba(99,102,241,0.5)] flex flex-col items-center animate-bounce">
            <h2 className="text-white font-black text-2xl mb-4 tracking-widest">RANDOM EVENT</h2>
            {isSpinning ? (
              <div className="text-4xl font-black text-amber-400 animate-pulse">{spinEvent?.name || "🎲"}</div>
            ) : (
              <div className="text-center animate-alert">
                <div className={`text-4xl font-black mb-2 ${spinEvent.effectColor} drop-shadow-lg`}>{spinEvent.name}</div>
                <div className="text-white font-bold text-sm bg-black/50 px-4 py-2 rounded-lg border border-white/20">{spinEvent.desc}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
