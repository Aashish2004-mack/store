import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Board geometry: a classic cross-shaped Ludo board on a 15x15 grid.
// The 56-cell outer ring is built from one 14-cell quarter (Red's, starting
// next to its yard) rotated three times by 90° around the board's centre,
// which is what keeps every step of the ring orthogonally adjacent to the
// next. Only two of the four yards (Red, Yellow — opposite corners) are used
// for this 2-player game; tokens still pass through the other two arms.
// ---------------------------------------------------------------------------
const RED_QUARTER = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
];
const rotate90 = ([r, c]) => [c, 14 - r];
const quarter = (q) => q.map(rotate90);

const Q0 = RED_QUARTER;
const Q1 = quarter(Q0);
const Q2 = quarter(Q1);
const Q3 = quarter(Q2);
const RING = [...Q0, ...Q1, ...Q2, ...Q3]; // 56 cells
const RING_LEN = RING.length;

const RED_HOME = [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]];
const YELLOW_HOME = [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]];
const GREEN_HOME = [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]];
const BLUE_HOME = [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]];
const CENTER = [7, 7];
const HOME_LEN = 6;
const FINISH_STEPS = RING_LEN - 1 + HOME_LEN; // 61

const RED_YARD = [[1, 1], [1, 4], [4, 1], [4, 4]];
const YELLOW_YARD = [[10, 10], [10, 13], [13, 10], [13, 13]];

const PLAYERS = {
  red: { label: "Red", color: "#C1272D", start: 0, home: RED_HOME, yard: RED_YARD },
  yellow: { label: "Yellow", color: "#D9A404", start: Q0.length + Q1.length, home: YELLOW_HOME, yard: YELLOW_YARD },
};
const other = (color) => (color === "red" ? "yellow" : "red");

function isSafeAbsIndex(idx) {
  const m = idx % 14;
  return m === 0 || m === 8;
}

function getPos(color, steps) {
  if (steps === -1) return null;
  if (steps === FINISH_STEPS) return CENTER;
  if (steps <= RING_LEN - 2) return RING[(PLAYERS[color].start + steps) % RING_LEN];
  return PLAYERS[color].home[steps - (RING_LEN - 1)];
}

// ---- static per-cell classification, computed once ----
const CELL_TYPE = Array.from({ length: 15 }, () => Array(15).fill(null));
for (let r = 0; r < 15; r++) {
  for (let c = 0; c < 15; c++) {
    if (r <= 5 && c <= 5) CELL_TYPE[r][c] = { type: "yard", color: "red" };
    else if (r >= 9 && c >= 9) CELL_TYPE[r][c] = { type: "yard", color: "yellow" };
    else if (r <= 5 && c >= 9) CELL_TYPE[r][c] = { type: "yard", color: "unused" };
    else if (r >= 9 && c <= 5) CELL_TYPE[r][c] = { type: "yard", color: "unused" };
  }
}
CELL_TYPE[CENTER[0]][CENTER[1]] = { type: "center" };
RED_HOME.forEach(([r, c]) => (CELL_TYPE[r][c] = { type: "home", color: "red" }));
YELLOW_HOME.forEach(([r, c]) => (CELL_TYPE[r][c] = { type: "home", color: "yellow" }));
GREEN_HOME.forEach(([r, c]) => (CELL_TYPE[r][c] = { type: "home", color: "unused" }));
BLUE_HOME.forEach(([r, c]) => (CELL_TYPE[r][c] = { type: "home", color: "unused" }));
RING.forEach(([r, c], idx) => {
  CELL_TYPE[r][c] = { type: "path", safe: isSafeAbsIndex(idx) };
});

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function computeMovable(color, tokens, roll) {
  const moves = [];
  tokens.forEach((steps, i) => {
    if (steps === -1) {
      if (roll === 6) moves.push({ i, newSteps: 0 });
      return;
    }
    if (steps === FINISH_STEPS) return;
    const newSteps = steps + roll;
    if (newSteps <= FINISH_STEPS) moves.push({ i, newSteps });
  });
  return moves;
}

const emptyTokens = () => [-1, -1, -1, -1];

export default function Ludo({ displayFont, inkFont, onBack }) {
  const [tokens, setTokens] = useState({ red: emptyTokens(), yellow: emptyTokens() });
  const [current, setCurrent] = useState("red");
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [canRoll, setCanRoll] = useState(true);
  const [movable, setMovable] = useState([]); // [{i, newSteps}]
  const [sixCount, setSixCount] = useState(0);
  const [winner, setWinner] = useState(null);
  const [message, setMessage] = useState("Red's turn — roll the dice.");
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const passTurn = () => {
    const next = other(current);
    setCurrent(next);
    setCanRoll(true);
    setMovable([]);
    setDice(null);
    setSixCount(0);
    setMessage(`${PLAYERS[next].label}'s turn — roll the dice.`);
  };

  const rollDice = () => {
    if (!canRoll || winner || rolling) return;
    setRolling(true);
    timerRef.current = setTimeout(() => {
      const roll = 1 + Math.floor(Math.random() * 6);
      setRolling(false);
      setDice(roll);

      const newSixCount = roll === 6 ? sixCount + 1 : 0;
      if (newSixCount === 3) {
        setSixCount(0);
        setCanRoll(false);
        setMessage(`${PLAYERS[current].label} rolled three 6s in a row — turn forfeited!`);
        timerRef.current = setTimeout(passTurn, 1300);
        return;
      }
      setSixCount(newSixCount);

      const moves = computeMovable(current, tokens[current], roll);
      if (moves.length === 0) {
        setCanRoll(false);
        setMessage(`Rolled ${roll} — no valid moves, turn passes.`);
        timerRef.current = setTimeout(passTurn, 1100);
        return;
      }
      setMovable(moves);
      setCanRoll(false);
      setMessage(`Rolled ${roll} — tap a highlighted piece to move it.`);
    }, 420);
  };

  const selectToken = (tokenIndex) => {
    const move = movable.find((m) => m.i === tokenIndex);
    if (!move || winner) return;

    const nextTokens = { red: [...tokens.red], yellow: [...tokens.yellow] };
    nextTokens[current][tokenIndex] = move.newSteps;

    let captured = false;
    if (move.newSteps <= RING_LEN - 2) {
      const absIdx = (PLAYERS[current].start + move.newSteps) % RING_LEN;
      if (!isSafeAbsIndex(absIdx)) {
        const opp = other(current);
        nextTokens[opp] = nextTokens[opp].map((s) => {
          if (s >= 0 && s <= RING_LEN - 2) {
            const oAbs = (PLAYERS[opp].start + s) % RING_LEN;
            if (oAbs === absIdx) {
              captured = true;
              return -1;
            }
          }
          return s;
        });
      }
    }

    setTokens(nextTokens);
    setMovable([]);

    const finished = move.newSteps === FINISH_STEPS;
    const won = nextTokens[current].every((s) => s === FINISH_STEPS);
    if (won) {
      setWinner(current);
      setCanRoll(false);
      setMessage(`🎉 ${PLAYERS[current].label} wins!`);
      return;
    }

    const bonus = dice === 6 || captured || finished;
    if (bonus) {
      setCanRoll(true);
      setDice(null);
      const why = captured ? "captured a piece" : finished ? "got a piece home" : "rolled a 6";
      setMessage(`${PLAYERS[current].label} ${why} — roll again!`);
    } else {
      passTurn();
    }
  };

  const newGame = () => {
    clearTimeout(timerRef.current);
    setTokens({ red: emptyTokens(), yellow: emptyTokens() });
    setCurrent("red");
    setDice(null);
    setRolling(false);
    setCanRoll(true);
    setMovable([]);
    setSixCount(0);
    setWinner(null);
    setMessage("Red's turn — roll the dice.");
  };

  // ---- board occupancy: cellKey -> [{color, i}] and yard occupancy ----
  const occupied = {};
  const yardTokens = { red: [], yellow: [] };
  ["red", "yellow"].forEach((color) => {
    tokens[color].forEach((steps, i) => {
      if (steps === -1) {
        yardTokens[color][i] = true;
        return;
      }
      const [r, c] = getPos(color, steps);
      const key = `${r},${c}`;
      (occupied[key] ||= []).push({ color, i });
    });
  });

  const movableSet = new Set(movable.map((m) => m.i));

  const cellBg = (info, r, c) => {
    if (info.type === "yard") {
      if (info.color === "unused") return "#e7e1d2";
      return PLAYERS[info.color].color + "22";
    }
    if (info.type === "center") return "#F3EFE4";
    if (info.type === "home") {
      if (info.color === "unused") return "#F3EFE4";
      return PLAYERS[info.color].color + "55";
    }
    if (info.type === "path") return info.safe ? "#fff7d6" : "#F3EFE4";
    return "#F3EFE4";
  };

  const Token = ({ color, i, small }) => {
    const isMine = color === current && movableSet.has(i) && !winner;
    return (
      <button
        key={i}
        onClick={() => isMine && selectToken(i)}
        disabled={!isMine}
        style={{
          width: small ? "62%" : "70%",
          height: small ? "62%" : "70%",
          borderRadius: "50%",
          background: PLAYERS[color].color,
          border: "2px solid #17181C",
          boxShadow: isMine ? `0 0 0 3px #F3EFE4, 0 0 0 5px ${PLAYERS[color].color}` : "0 1px 2px rgba(0,0,0,0.4)",
          cursor: isMine ? "pointer" : "default",
          padding: 0,
          animation: isMine ? "ludo-pulse 1s ease-in-out infinite" : "none",
        }}
      />
    );
  };

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "24px 16px 60px", fontFamily: inkFont }}>
      <style>{`
        @keyframes ludo-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        @keyframes ludo-roll { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      <h1 style={{ fontFamily: displayFont, fontSize: 26, margin: "0 0 4px" }}>🎲 Ludo</h1>
      <p style={{ fontSize: 13, color: "#6b665b", margin: "0 0 18px" }}>
        Local pass-and-play — hand the phone to the other player on their turn. No internet needed.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(15, 1fr)",
          gridTemplateRows: "repeat(15, 1fr)",
          width: "100%",
          aspectRatio: "1 / 1",
          border: "3px solid #17181C",
          background: "#17181C",
          gap: "1px",
        }}
      >
        {Array.from({ length: 15 }).map((_, r) =>
          Array.from({ length: 15 }).map((__, c) => {
            const info = CELL_TYPE[r][c];
            const key = `${r},${c}`;
            const occ = occupied[key];
            const isYardSlot = info.type === "yard" && info.color !== "unused";
            let yardToken = null;
            if (isYardSlot) {
              const slots = PLAYERS[info.color].yard;
              const idx = slots.findIndex(([sr, sc]) => sr === r && sc === c);
              if (idx !== -1 && yardTokens[info.color][idx]) yardToken = { color: info.color, i: idx };
            }
            return (
              <div
                key={key}
                style={{
                  background: cellBg(info, r, c),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  fontSize: "clamp(6px, 1.4vw, 11px)",
                  color: "#8A8478",
                }}
              >
                {info.type === "path" && info.safe && !occ && "★"}
                {info.type === "center" && !occ?.length && (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: `conic-gradient(${PLAYERS.red.color} 0deg 90deg, ${PLAYERS.yellow.color} 90deg 180deg, #8A8478 180deg 270deg, #8A8478 270deg 360deg)`,
                    }}
                  />
                )}
                {yardToken && <Token color={yardToken.color} i={yardToken.i} small />}
                {occ && occ.length === 1 && <Token color={occ[0].color} i={occ[0].i} />}
                {occ && occ.length > 1 && (
                  <div style={{ display: "flex", flexWrap: "wrap", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", gap: 1 }}>
                    {occ.map((t) => (
                      <Token key={t.i} color={t.color} i={t.i} small />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ---- controls ---- */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px",
            border: "2px solid #17181C",
            borderRadius: 6,
            background: current === "red" ? PLAYERS.red.color + "22" : PLAYERS.yellow.color + "22",
          }}
        >
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: PLAYERS[current].color, display: "inline-block", border: "2px solid #17181C" }} />
          <span style={{ fontWeight: 700 }}>{PLAYERS[current].label}'s turn</span>
        </div>

        <p style={{ fontSize: 14, textAlign: "center", minHeight: 20, margin: 0 }}>{message}</p>

        <button
          onClick={rollDice}
          disabled={!canRoll || rolling || !!winner}
          style={{
            fontSize: 40,
            lineHeight: 1,
            background: "#fff",
            border: "3px solid #17181C",
            borderRadius: 10,
            width: 74,
            height: 74,
            cursor: canRoll && !winner ? "pointer" : "default",
            opacity: canRoll && !winner ? 1 : 0.5,
            animation: rolling ? "ludo-roll 0.4s linear" : "none",
          }}
        >
          {DICE_FACES[dice || 6] === "" ? "⚅" : dice ? DICE_FACES[dice] : "⚅"}
        </button>

        {winner && (
          <div style={{ fontFamily: displayFont, fontSize: 20, color: PLAYERS[winner].color, textAlign: "center" }}>
            🎉 {PLAYERS[winner].label} wins!
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={newGame}
            style={{ background: "#17181C", color: "#F3EFE4", border: "none", padding: "8px 16px", borderRadius: 4, fontSize: 13 }}
          >
            New game
          </button>
          {onBack && (
            <button
              onClick={onBack}
              style={{ background: "none", border: "1px solid #17181C", padding: "8px 16px", borderRadius: 4, fontSize: 13 }}
            >
              Back to shop
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
