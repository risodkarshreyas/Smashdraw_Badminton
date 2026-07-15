"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Participant = {
  id: number;
  name: string;
};

type Match = {
  id: number;
  playerOne: Participant;
  playerTwo: Participant;
};

type Draw = {
  matches: Match[];
  byes: Participant[];
  createdAt: Date;
};

type MatchResultDraft = {
  playerOneScore: string;
  playerTwoScore: string;
  winnerId?: number;
};

type SavedMatch = {
  matchNumber: number;
  playerOne: string;
  playerOneScore: string;
  playerTwo: string;
  playerTwoScore: string;
  winner: string;
};

type HistoryRound = {
  id: string;
  roundLabel: string;
  matches: SavedMatch[];
  savedAt: string;
};

const sampleParticipants = [
  "Aarav Shah",
  "Meera Iyer",
  "Rohan Kulkarni",
  "Ananya Rao",
  "Kabir Mehta",
  "Ishita Nair",
  "Arjun Desai",
  "Diya Menon",
  "Vivaan Joshi",
  "Saanvi Patil",
  "Aditya Bhat",
  "Tara Kapoor",
  "Neel Verma",
  "Riya Sen",
  "Kunal Bose",
  "Nisha Jain",
  "Dev Malhotra",
  "Maya Pillai",
  "Siddharth Roy",
  "Aditi Naik",
].join("\n");

function parseNames(value: string) {
  const seen = new Set<string>();

  return value
    .split(/\r?\n|,/)
    .map((name) => name.replace(/^\s*\d+[.)-]\s*/, "").trim())
    .filter((name) => {
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const swapIndex = values[0] % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function makeDraw(names: string[], protectTopFour: boolean): Draw {
  const participants = names.map((name, index) => ({
    id: index + 1,
    name,
  }));
  const matches: Match[] = [];
  const byes: Participant[] = [];

  if (!protectTopFour) {
    const pool = shuffle(participants);
    if (pool.length % 2 === 1) byes.push(pool.pop()!);
    for (let index = 0; index < pool.length; index += 2) {
      matches.push({
        id: matches.length + 1,
        playerOne: pool[index],
        playerTwo: pool[index + 1],
      });
    }
    return { matches, byes, createdAt: new Date() };
  }

  const protectedPlayers = shuffle(participants.slice(0, 4));
  let openPlayers = shuffle(participants.slice(4));
  const byeCount = Math.max(participants.length % 2, protectedPlayers.length - openPlayers.length);

  for (let index = 0; index < byeCount; index += 1) {
    if (protectedPlayers.length > openPlayers.length) {
      byes.push(protectedPlayers.pop()!);
    } else {
      byes.push(openPlayers.pop()!);
    }
  }

  while (protectedPlayers.length > 0) {
    matches.push({
      id: matches.length + 1,
      playerOne: protectedPlayers.pop()!,
      playerTwo: openPlayers.pop()!,
    });
  }

  openPlayers = shuffle(openPlayers);
  for (let index = 0; index < openPlayers.length; index += 2) {
    matches.push({
      id: matches.length + 1,
      playerOne: openPlayers[index],
      playerTwo: openPlayers[index + 1],
    });
  }

  return {
    matches: shuffle(matches).map((match, index) => ({ ...match, id: index + 1 })),
    byes: shuffle(byes),
    createdAt: new Date(),
  };
}

function ParticipantSlot({ participant }: { participant: Participant }) {
  return (
    <div className="participant-slot">
      <span className="participant-number">{String(participant.id).padStart(2, "0")}</span>
      <span className="participant-name">{participant.name}</span>
    </div>
  );
}

export default function Home() {
  const [participantText, setParticipantText] = useState(sampleParticipants);
  const [protectTopFour, setProtectTopFour] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [activeTab, setActiveTab] = useState<"draw" | "history" | "admin">("draw");
  const [draw, setDraw] = useState<Draw | null>(null);
  const [roundLabel, setRoundLabel] = useState("01");
  const [matchResults, setMatchResults] = useState<Record<number, MatchResultDraft>>({});
  const [isSavingResults, setIsSavingResults] = useState(false);
  const [resultsSaved, setResultsSaved] = useState(false);
  const [resultsMessage, setResultsMessage] = useState("");
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const [message, setMessage] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const names = useMemo(() => parseNames(participantText), [participantText]);

  useEffect(() => {
    fetch("/api/tournament-config", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Config not found");
        return response.json();
      })
      .then((config: { protectTopFour?: boolean }) => {
        setProtectTopFour(config.protectTopFour !== false);
      })
      .catch(() => {
        setProtectTopFour(true);
      })
      .finally(() => setConfigLoaded(true));
  }, []);

  useEffect(() => {
    if (activeTab !== "history" || historyLoaded) return;

    fetch("/api/match-history", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { rounds?: HistoryRound[]; error?: string };
        if (!response.ok || !Array.isArray(payload.rounds)) {
          throw new Error(payload.error ?? "Match history could not be loaded.");
        }
        setHistory(payload.rounds);
      })
      .catch((error) => {
        setHistoryMessage(error instanceof Error ? error.message : "Match history could not be loaded.");
      })
      .finally(() => setHistoryLoaded(true));
  }, [activeTab, historyLoaded]);

  async function updateProtectionRule() {
    if (isSavingRule) return;
    setIsSavingRule(true);
    setAdminMessage("");

    try {
      const nextValue = !protectTopFour;
      const response = await fetch("/api/tournament-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protectTopFour: nextValue }),
      });
      const payload = (await response.json()) as { protectTopFour?: boolean; error?: string };
      if (!response.ok || typeof payload.protectTopFour !== "boolean") {
        throw new Error(payload.error ?? "The rule could not be updated.");
      }

      setProtectTopFour(payload.protectTopFour);
      setDraw(null);
      setAdminMessage(`Top-four protection turned ${payload.protectTopFour ? "on" : "off"}.`);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "The rule could not be updated.");
    } finally {
      setIsSavingRule(false);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    setMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let importedNames: string[] = [];

      if (extension === "txt") {
        importedNames = parseNames(await file.text());
      } else {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
          header: 1,
          raw: false,
        });

        importedNames = rows
          .map((row) => row.find((cell) => String(cell ?? "").trim() !== ""))
          .filter((cell): cell is string | number => cell !== undefined)
          .map((cell) => String(cell).trim());

        if (/^(participant|participant name|player|player name|name)$/i.test(importedNames[0] ?? "")) {
          importedNames.shift();
        }
        importedNames = parseNames(importedNames.join("\n"));
      }

      if (importedNames.length < 2) {
        throw new Error("The file needs at least two participant names in its first column.");
      }

      setParticipantText(importedNames.join("\n"));
      setDraw(null);
      setMessage(`${importedNames.length} participants imported from ${file.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That file could not be read.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void importFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void importFile(event.dataTransfer.files?.[0]);
  }

  function generateDraw() {
    setMessage("");
    if (names.length < 2) {
      setMessage("Add at least two participants before generating the draw.");
      return;
    }
    if (protectTopFour && names.length < 5) {
      setMessage("Add at least one participant outside positions 1–4, or turn off top-four protection in the Admin tab.");
      return;
    }
    setDraw(makeDraw(names, protectTopFour));
    setMatchResults({});
    setResultsSaved(false);
    setResultsMessage("");
    requestAnimationFrame(() => document.getElementById("draw-board")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function updateMatchResult(matchId: number, update: Partial<MatchResultDraft>) {
    setMatchResults((current) => ({
      ...current,
      [matchId]: {
        playerOneScore: current[matchId]?.playerOneScore ?? "",
        playerTwoScore: current[matchId]?.playerTwoScore ?? "",
        winnerId: current[matchId]?.winnerId,
        ...update,
      },
    }));
    setResultsSaved(false);
    setResultsMessage("");
  }

  function resetMatchResult(matchId: number) {
    setMatchResults((current) => {
      const next = { ...current };
      delete next[matchId];
      return next;
    });
    setResultsSaved(false);
    setResultsMessage("");
  }

  async function saveRoundResults() {
    if (!draw || isSavingResults) return;
    const cleanRoundLabel = roundLabel.trim();
    if (!cleanRoundLabel) {
      setResultsMessage("Enter a round number or name before saving.");
      return;
    }

    const matches = draw.matches.map((match): SavedMatch | null => {
      const result = matchResults[match.id];
      if (!result?.playerOneScore.trim() || !result.playerTwoScore.trim() || !result.winnerId) return null;
      return {
        matchNumber: match.id,
        playerOne: match.playerOne.name,
        playerOneScore: result.playerOneScore.trim(),
        playerTwo: match.playerTwo.name,
        playerTwoScore: result.playerTwoScore.trim(),
        winner: result.winnerId === match.playerOne.id ? match.playerOne.name : match.playerTwo.name,
      };
    });

    if (matches.some((match) => match === null)) {
      setResultsMessage("Add both scores and mark a winner for every match.");
      return;
    }

    setIsSavingResults(true);
    setResultsMessage("");
    try {
      const response = await fetch("/api/match-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundLabel: cleanRoundLabel, matches }),
      });
      const payload = (await response.json()) as { round?: HistoryRound; error?: string };
      if (!response.ok || !payload.round) throw new Error(payload.error ?? "Results could not be saved.");

      const savedRound = payload.round;
      const savedRoundKey = savedRound.roundLabel.trim().toLocaleLowerCase();
      setHistory((current) => [
        savedRound,
        ...current.filter((round) => round.roundLabel.trim().toLocaleLowerCase() !== savedRoundKey),
      ]);
      setHistoryLoaded(true);
      setResultsSaved(true);
      setResultsMessage("Round results saved to History.");
    } catch (error) {
      setResultsMessage(error instanceof Error ? error.message : "Results could not be saved.");
    } finally {
      setIsSavingResults(false);
    }
  }

  function exportResults() {
    if (history.length === 0) return;
    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["Round", "Saved at", "Match", "Player 1", "Score 1", "Player 2", "Score 2", "Winner"]];

    for (const round of history) {
      for (const match of round.matches) {
        rows.push([
          round.roundLabel,
          new Date(round.savedAt).toLocaleString(),
          String(match.matchNumber),
          match.playerOne,
          match.playerOneScore,
          match.playerTwo,
          match.playerTwoScore,
          match.winner,
        ]);
      }
    }

    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `smashdraw-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    setParticipantText("");
    setDraw(null);
    setMatchResults({});
    setResultsSaved(false);
    setResultsMessage("");
    setMessage("");
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="SmashDraw home" onClick={() => setActiveTab("draw")}>
          <span className="brand-mark" aria-hidden="true"><i /><b /></span>
          <span>SMASH<span>DRAW</span></span>
        </a>
        <div className="header-actions">
          <nav className="site-tabs" aria-label="Application sections">
            <button
              className={activeTab === "draw" ? "active" : ""}
              type="button"
              aria-current={activeTab === "draw" ? "page" : undefined}
              onClick={() => setActiveTab("draw")}
            >Draw</button>
            <button
              className={activeTab === "history" ? "active" : ""}
              type="button"
              aria-current={activeTab === "history" ? "page" : undefined}
              onClick={() => setActiveTab("history")}
            >History</button>
            <button
              className={activeTab === "admin" ? "active" : ""}
              type="button"
              aria-current={activeTab === "admin" ? "page" : undefined}
              onClick={() => setActiveTab("admin")}
            >Admin</button>
          </nav>
          <span className="header-kicker">Knockout tournament maker</span>
        </div>
      </header>

      {activeTab === "draw" ? <>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Ready. Set. Smash.</p>
          <h1>One click.<br /><em>A fair knockout draw.</em></h1>
          <p className="hero-description">
            Add your players, shuffle the matchups, and get a tournament-ready first-round fixture in seconds.
          </p>
          <div className="hero-stats" aria-label="Tournament summary">
            <div><strong>{names.length}</strong><span>Players ready</span></div>
            <div><strong>{Math.floor(names.length / 2)}</strong><span>Possible matches</span></div>
            <div><strong>1</strong><span>Round at a time</span></div>
          </div>
        </div>
        <div className="court-art" aria-hidden="true">
          <div className="court-lines" />
          <div className="shuttle-orbit"><span /></div>
          <p>THE DRAW<br />STARTS HERE</p>
        </div>
      </section>

      <section className="workspace" aria-label="Create tournament draw">
        <div className="entry-panel">
          <div className="panel-heading">
            <div>
              <span className="step-number">01</span>
              <p className="section-label">Build the field</p>
              <h2>Add participants</h2>
            </div>
            <span className="count-pill">{names.length} entered</span>
          </div>

          <label className="field-label" htmlFor="participants">One participant per line</label>
          <textarea
            id="participants"
            value={participantText}
            onChange={(event) => {
              setParticipantText(event.target.value);
              setDraw(null);
              setMessage("");
            }}
            placeholder={"1. Participant name\n2. Participant name\n3. Participant name"}
            spellCheck="false"
          />

          <div
            className={`file-drop ${isDragging ? "is-dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <span className="upload-icon" aria-hidden="true">↥</span>
            <div><strong>Drop a participant file here</strong><small>TXT, CSV, XLS or XLSX · names in the first column</small></div>
            <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>Choose file</button>
            <input ref={fileInputRef} type="file" accept=".txt,.csv,.xls,.xlsx" onChange={handleFileChange} hidden />
          </div>

          {message && <p className="form-message" role="status">{message}</p>}

          <div className="form-actions">
            <button className="primary-button" type="button" onClick={generateDraw}><span>Generate random draw</span><b aria-hidden="true">→</b></button>
            <button className="text-button" type="button" onClick={resetAll}>Clear all</button>
          </div>
        </div>

        <aside className="format-panel">
          <span className="step-number">02</span>
          <p className="section-label">How it works</p>
          <h2>Next round only</h2>
          <p>Every click creates a fresh randomized fixture for the immediate knockout round. Enter scores and winners after play; future rounds are not generated automatically.</p>
          <ol>
            <li><span>1</span><div><strong>Order your list</strong><small>Positions 1–4 are the protected entries when the rule is on.</small></div></li>
            <li><span>2</span><div><strong>Generate the draw</strong><small>Players are shuffled and paired without protected clashes.</small></div></li>
            <li><span>3</span><div><strong>Record the results</strong><small>Add scores, mark each winner and save the round to History.</small></div></li>
          </ol>
        </aside>
      </section>

      {draw && (
        <section className="draw-section" id="draw-board">
          <div className="draw-heading">
            <div>
              <p className="eyebrow">Draw complete</p>
              <h2 className="round-title">Knockout round <input aria-label="Round number or name" maxLength={40} value={roundLabel} onChange={(event) => { setRoundLabel(event.target.value); setResultsSaved(false); }} /></h2>
              <p>{draw.matches.length} matches · {draw.byes.length} {draw.byes.length === 1 ? "bye" : "byes"} · Generated {draw.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              {resultsMessage && <p className={`results-message ${resultsSaved ? "success" : ""}`} role="status">{resultsMessage}</p>}
            </div>
            <div className="draw-actions">
              <button className="primary-button compact" type="button" disabled={isSavingResults || resultsSaved} onClick={() => void saveRoundResults()}>{resultsSaved ? "Saved ✓" : isSavingResults ? "Saving…" : "Save results"}</button>
              <button className="secondary-button" type="button" onClick={() => window.print()}>Print draw</button>
              <button className="secondary-button" type="button" onClick={generateDraw}>Shuffle again ↻</button>
            </div>
          </div>

          <div className="match-grid">
            {draw.matches.map((match) => (
              <article className="match-card" key={`${draw.createdAt.getTime()}-${match.id}`}>
                <div className="match-label">
                  <span>Match</span>
                  <strong>{String(match.id).padStart(2, "0")}</strong>
                  <button type="button" disabled={!matchResults[match.id]} onClick={() => resetMatchResult(match.id)}>Reset</button>
                </div>
                <div className="match-players">
                  <div className="result-row">
                    <ParticipantSlot participant={match.playerOne} />
                    <input
                      className="score-input"
                      aria-label={`Score for ${match.playerOne.name}`}
                      placeholder="Score"
                      maxLength={40}
                      value={matchResults[match.id]?.playerOneScore ?? ""}
                      onChange={(event) => updateMatchResult(match.id, { playerOneScore: event.target.value })}
                    />
                    <button
                      className={`winner-button ${matchResults[match.id]?.winnerId === match.playerOne.id ? "selected" : ""}`}
                      type="button"
                      aria-pressed={matchResults[match.id]?.winnerId === match.playerOne.id}
                      onClick={() => updateMatchResult(match.id, { winnerId: matchResults[match.id]?.winnerId === match.playerOne.id ? undefined : match.playerOne.id })}
                    >Winner</button>
                  </div>
                  <span className="versus">VS</span>
                  <div className="result-row">
                    <ParticipantSlot participant={match.playerTwo} />
                    <input
                      className="score-input"
                      aria-label={`Score for ${match.playerTwo.name}`}
                      placeholder="Score"
                      maxLength={40}
                      value={matchResults[match.id]?.playerTwoScore ?? ""}
                      onChange={(event) => updateMatchResult(match.id, { playerTwoScore: event.target.value })}
                    />
                    <button
                      className={`winner-button ${matchResults[match.id]?.winnerId === match.playerTwo.id ? "selected" : ""}`}
                      type="button"
                      aria-pressed={matchResults[match.id]?.winnerId === match.playerTwo.id}
                      onClick={() => updateMatchResult(match.id, { winnerId: matchResults[match.id]?.winnerId === match.playerTwo.id ? undefined : match.playerTwo.id })}
                    >Winner</button>
                  </div>
                </div>
                <div className="connector" aria-hidden="true"><i /><b /></div>
              </article>
            ))}
          </div>

          {draw.byes.length > 0 && (
            <div className="bye-panel">
              <div><span className="bye-icon">↗</span><div><p className="section-label">Automatic advance</p><h3>Byes to the next round</h3></div></div>
              <div className="bye-list">
                {draw.byes.map((participant) => <ParticipantSlot participant={participant} key={participant.id} />)}
              </div>
            </div>
          )}
        </section>
      )}

      </> : activeTab === "history" ? (
        <section className="history-page" id="top">
          <div className="history-heading">
            <div>
              <p className="eyebrow">Saved tournament results</p>
              <h1>Match<br /><em>history.</em></h1>
              <p>Each saved round keeps its matchups, scores, winners and save time. History is shared with everyone using this tournament site.</p>
            </div>
            <div className="history-actions">
              <button className="primary-button compact" type="button" disabled={history.length === 0} onClick={exportResults}>Export CSV</button>
              <button className="secondary-button" type="button" onClick={() => setActiveTab("draw")}>Return to draw</button>
            </div>
          </div>

          {historyMessage && <p className="history-message" role="status">{historyMessage}</p>}
          {historyLoaded && history.length === 0 && !historyMessage && (
            <div className="empty-history">
              <span>00</span>
              <h2>No saved results yet</h2>
              <p>Generate a draw, enter each score, mark the winners and choose Save results.</p>
              <button className="primary-button compact" type="button" onClick={() => setActiveTab("draw")}>Create a draw</button>
            </div>
          )}

          <div className="history-list">
            {history.map((round) => (
              <article className="history-round" key={round.id}>
                <div className="history-round-heading">
                  <div><p className="section-label">Knockout round</p><h2>{round.roundLabel}</h2></div>
                  <p>{round.matches.length} {round.matches.length === 1 ? "match" : "matches"} · Saved {new Date(round.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <div className="history-matches">
                  {round.matches.map((match) => (
                    <div className="history-match" key={`${round.id}-${match.matchNumber}`}>
                      <span className="history-match-number">Match {String(match.matchNumber).padStart(2, "0")}</span>
                      <div className={match.winner === match.playerOne ? "history-winner" : ""}><strong>{match.playerOne}</strong><b>{match.playerOneScore}</b>{match.winner === match.playerOne && <em>Winner</em>}</div>
                      <div className={match.winner === match.playerTwo ? "history-winner" : ""}><strong>{match.playerTwo}</strong><b>{match.playerTwoScore}</b>{match.winner === match.playerTwo && <em>Winner</em>}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="admin-page" id="top">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">Tournament settings</p>
              <h1>Admin<br /><em>controls.</em></h1>
              <p>Manage tournament-wide rules without signing in. Changes apply immediately to every future draw and every user.</p>
            </div>
            <span className="admin-shield" aria-hidden="true">A</span>
          </div>

          <div className="admin-workspace">
            <div className="admin-panel">
              <span className="step-number">01</span>
              <p className="section-label">Draw protection</p>
              <h2>Tournament rules</h2>

              <div className="rule-card admin-rule-card">
                <span className={`rule-status ${protectTopFour ? "on" : "off"}`}><i />{configLoaded ? (protectTopFour ? "Rule on" : "Rule off") : "Loading rule"}</span>
                <div>
                  <strong>Protect participants 1–4</strong>
                  <p>{protectTopFour ? "The first four entrants cannot draw one another." : "All participants may draw one another."}</p>
                  <small>This control is available to everyone using the application.</small>
                </div>
                <button
                  className={`admin-toggle ${protectTopFour ? "is-on" : ""}`}
                  type="button"
                  role="switch"
                  aria-checked={protectTopFour}
                  aria-label="Protect participants 1 to 4"
                  disabled={!configLoaded || isSavingRule}
                  onClick={updateProtectionRule}
                >
                  <span><i /></span>
                  <b>{isSavingRule ? "Saving" : "Rule control"}</b>
                </button>
              </div>

              {adminMessage && <p className="admin-message" role="status">{adminMessage}</p>}
            </div>

            <aside className="admin-note">
              <span className="step-number">02</span>
              <p className="section-label">Rule behavior</p>
              <h2>What this changes</h2>
              <p>When enabled, positions 1, 2, 3 and 4 are kept apart during random pairing. The fixture itself stays clean—players are not marked or labelled as protected.</p>
              <button className="secondary-button" type="button" onClick={() => setActiveTab("draw")}>Return to draw</button>
            </aside>
          </div>
        </section>
      )}

      <footer><span>SMASHDRAW</span><p>Simple, fair, tournament-ready.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
