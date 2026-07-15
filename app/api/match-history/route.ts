import { createHash } from "node:crypto";
import { TableClient } from "@azure/data-tables";

export const dynamic = "force-dynamic";

const TABLE_NAME = "TournamentHistory";
const PARTITION_KEY = "smashdraw";

type ErrorWithStatus = Error & {
  statusCode?: number;
  code?: string;
};

type SavedMatch = {
  matchNumber: number;
  playerOne: string;
  playerOneScore: string;
  playerTwo: string;
  playerTwoScore: string;
  winner: string;
};

type HistoryEntity = {
  partitionKey: string;
  rowKey: string;
  roundName?: string;
  roundLabel: string;
  roundKey?: string;
  matchesJson: string;
  savedAt: string;
};

let tableClientPromise: Promise<TableClient> | null = null;

function errorStatus(error: unknown) {
  const candidate = error as ErrorWithStatus;
  return { statusCode: candidate?.statusCode, code: candidate?.code };
}

function getTableClient() {
  if (tableClientPromise) return tableClientPromise;

  tableClientPromise = (async () => {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured.");

    const client = TableClient.fromConnectionString(connectionString, TABLE_NAME);
    try {
      await client.createTable();
    } catch (error) {
      const { statusCode, code } = errorStatus(error);
      if (statusCode !== 409 && code !== "TableAlreadyExists") throw error;
    }
    return client;
  })();

  return tableClientPromise;
}

function isSavedMatch(value: unknown): value is SavedMatch {
  if (!value || typeof value !== "object") return false;
  const match = value as Partial<SavedMatch>;
  return Number.isInteger(match.matchNumber)
    && typeof match.playerOne === "string"
    && typeof match.playerOneScore === "string"
    && typeof match.playerTwo === "string"
    && typeof match.playerTwoScore === "string"
    && typeof match.winner === "string"
    && (match.winner === "" || [match.playerOne, match.playerTwo].includes(match.winner));
}

function normalizeRoundKey(roundName: string, roundLabel: string) {
  return `${roundName.trim().toLocaleLowerCase()}::${roundLabel.trim().toLocaleLowerCase()}`;
}

export async function GET() {
  try {
    const client = await getTableClient();
    const roundsByKey = new Map<string, { id: string; roundName: string; roundLabel: string; matches: SavedMatch[]; savedAt: string }>();

    for await (const entity of client.listEntities<HistoryEntity>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
    })) {
      try {
        const matches = JSON.parse(entity.matchesJson) as unknown;
        if (!Array.isArray(matches) || !matches.every(isSavedMatch)) continue;
        const roundName = entity.roundName?.trim() || "Knockout round";
        const round = {
          id: entity.rowKey,
          roundName,
          roundLabel: entity.roundLabel,
          matches,
          savedAt: entity.savedAt,
        };
        const roundKey = normalizeRoundKey(roundName, entity.roundLabel);
        const existing = roundsByKey.get(roundKey);
        if (!existing || round.savedAt > existing.savedAt) roundsByKey.set(roundKey, round);
      } catch {
        // Ignore malformed legacy rows instead of failing the complete history response.
      }
    }

    const rounds = [...roundsByKey.values()].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    return Response.json({ rounds });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Match history is unavailable." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { roundName?: unknown; roundLabel?: unknown; matches?: unknown };
    const roundName = typeof payload.roundName === "string" ? payload.roundName.trim() : "";
    const roundLabel = typeof payload.roundLabel === "string" ? payload.roundLabel.trim() : "";

    if (!roundName || roundName.length > 40) {
      return Response.json({ error: "Enter a round title of 1–40 characters." }, { status: 400 });
    }
    if (!roundLabel || roundLabel.length > 40) {
      return Response.json({ error: "Enter a round label of 1–40 characters." }, { status: 400 });
    }
    if (!Array.isArray(payload.matches) || payload.matches.length === 0 || !payload.matches.every(isSavedMatch)) {
      return Response.json({ error: "The round does not contain valid matches." }, { status: 400 });
    }

    const savedAt = new Date().toISOString();
    const roundKey = normalizeRoundKey(roundName, roundLabel);
    const rowKey = createHash("sha256").update(roundKey).digest("hex");
    const entity: HistoryEntity = {
      partitionKey: PARTITION_KEY,
      rowKey,
      roundName,
      roundLabel,
      roundKey,
      matchesJson: JSON.stringify(payload.matches),
      savedAt,
    };

    const client = await getTableClient();
    await client.upsertEntity(entity, "Replace");

    // Remove snapshots created by the earlier append-only implementation.
    for await (const previous of client.listEntities<HistoryEntity>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
    })) {
      const previousRoundName = previous.roundName?.trim() || "Knockout round";
      if (previous.rowKey !== rowKey && normalizeRoundKey(previousRoundName, previous.roundLabel) === roundKey) {
        await client.deleteEntity(previous.partitionKey, previous.rowKey);
      }
    }

    return Response.json({
      round: { id: rowKey, roundName, roundLabel, matches: payload.matches, savedAt },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Match results could not be saved." },
      { status: 500 },
    );
  }
}
