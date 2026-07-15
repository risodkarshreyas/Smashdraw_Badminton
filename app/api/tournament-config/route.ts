import { TableClient } from "@azure/data-tables";

export const dynamic = "force-dynamic";

const TABLE_NAME = "TournamentSettings";
const PARTITION_KEY = "smashdraw";
const ROW_KEY = "protectTopFour";

type ErrorWithStatus = Error & {
  statusCode?: number;
  code?: string;
};

type SettingEntity = {
  partitionKey: string;
  rowKey: string;
  value: string;
  updatedAt?: string;
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
    if (!connectionString) {
      throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured.");
    }

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

async function readProtectionSetting() {
  const client = await getTableClient();
  try {
    const setting = await client.getEntity<SettingEntity>(PARTITION_KEY, ROW_KEY);
    return setting.value !== "false";
  } catch (error) {
    const { statusCode, code } = errorStatus(error);
    if (statusCode === 404 || code === "ResourceNotFound" || code === "EntityNotFound") return true;
    throw error;
  }
}

export async function GET() {
  try {
    return Response.json({ protectTopFour: await readProtectionSetting() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Configuration is unavailable." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as { protectTopFour?: unknown };
    if (typeof payload.protectTopFour !== "boolean") {
      return Response.json({ error: "protectTopFour must be true or false." }, { status: 400 });
    }

    const client = await getTableClient();
    await client.upsertEntity<SettingEntity>(
      {
        partitionKey: PARTITION_KEY,
        rowKey: ROW_KEY,
        value: String(payload.protectTopFour),
        updatedAt: new Date().toISOString(),
      },
      "Replace",
    );

    return Response.json({ protectTopFour: payload.protectTopFour });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The rule could not be updated." },
      { status: 500 },
    );
  }
}
