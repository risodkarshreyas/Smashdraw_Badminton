"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Participant = {
  id: number;
  name: string;
  protected: boolean;
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
    protected: protectTopFour && index < 4,
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

  let protectedPlayers = shuffle(participants.slice(0, 4));
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
      {participant.protected && <span className="seed-badge">Protected</span>}
    </div>
  );
}

export default function Home() {
  const [participantText, setParticipantText] = useState(sampleParticipants);
  const [protectTopFour, setProtectTopFour] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const names = useMemo(() => parseNames(participantText), [participantText]);

  useEffect(() => {
    fetch("/tournament-config.json")
      .then((response) => {
        if (!response.ok) throw new Error("Config not found");
        return response.json();
      })
      .then((config: { protectTopFour?: boolean }) => {
        setProtectTopFour(config.protectTopFour !== false);
      })
      .catch(() => setProtectTopFour(true))
      .finally(() => setConfigLoaded(true));
  }, []);

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
      setMessage("Add at least one participant outside positions 1–4, or turn the protection rule off in tournament-config.json.");
      return;
    }
    setDraw(makeDraw(names, protectTopFour));
    requestAnimationFrame(() => document.getElementById("draw-board")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function resetAll() {
    setParticipantText("");
    setDraw(null);
    setMessage("");
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="SmashDraw home">
          <span className="brand-mark" aria-hidden="true"><i /><b /></span>
          <span>SMASH<span>DRAW</span></span>
        </a>
        <span className="header-kicker">Knockout tournament maker</span>
      </header>

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

          <div className="rule-card">
            <span className={`rule-status ${protectTopFour ? "on" : "off"}`}><i />{configLoaded ? (protectTopFour ? "Rule on" : "Rule off") : "Loading rule"}</span>
            <div>
              <strong>Protect participants 1–4</strong>
              <p>{protectTopFour ? "The first four entrants cannot draw one another." : "All participants may draw one another."}</p>
              <small>Controlled by <code>public/tournament-config.json</code></small>
            </div>
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
          <p>Every click creates a fresh randomized fixture for the immediate knockout round. Winners are not predicted and future rounds are not generated.</p>
          <ol>
            <li><span>1</span><div><strong>Order your list</strong><small>Positions 1–4 are the protected entries when the rule is on.</small></div></li>
            <li><span>2</span><div><strong>Generate the draw</strong><small>Players are shuffled and paired without protected clashes.</small></div></li>
            <li><span>3</span><div><strong>Print or save</strong><small>Use your browser’s print option for a clean fixture sheet.</small></div></li>
          </ol>
        </aside>
      </section>

      {draw && (
        <section className="draw-section" id="draw-board">
          <div className="draw-heading">
            <div>
              <p className="eyebrow">Draw complete</p>
              <h2>Knockout round <span>01</span></h2>
              <p>{draw.matches.length} matches · {draw.byes.length} {draw.byes.length === 1 ? "bye" : "byes"} · Generated {draw.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <div className="draw-actions">
              <button className="secondary-button" type="button" onClick={() => window.print()}>Print draw</button>
              <button className="primary-button compact" type="button" onClick={generateDraw}>Shuffle again ↻</button>
            </div>
          </div>

          <div className="match-grid">
            {draw.matches.map((match) => (
              <article className="match-card" key={`${draw.createdAt.getTime()}-${match.id}`}>
                <div className="match-label"><span>Match</span><strong>{String(match.id).padStart(2, "0")}</strong></div>
                <div className="match-players">
                  <ParticipantSlot participant={match.playerOne} />
                  <span className="versus">VS</span>
                  <ParticipantSlot participant={match.playerTwo} />
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

      <footer><span>SMASHDRAW</span><p>Simple, fair, tournament-ready.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
