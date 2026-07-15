import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { appSettings } from "../../../db/schema";

export const dynamic = "force-dynamic";

const SETTING_KEY = "protectTopFour";

async function readProtectionSetting() {
  const [setting] = await getDb()
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, SETTING_KEY))
    .limit(1);

  return setting ? setting.value === "true" : true;
}

export async function GET() {
  try {
    const protectTopFour = await readProtectionSetting();
    return Response.json({ protectTopFour });
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

    const updatedAt = new Date().toISOString();
    await getDb()
      .insert(appSettings)
      .values({
        key: SETTING_KEY,
        value: String(payload.protectTopFour),
        updatedAt,
        updatedBy: "shared-admin-tab",
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: String(payload.protectTopFour),
          updatedAt,
          updatedBy: "shared-admin-tab",
        },
      });

    return Response.json({ protectTopFour: payload.protectTopFour });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The rule could not be updated." },
      { status: 500 },
    );
  }
}
