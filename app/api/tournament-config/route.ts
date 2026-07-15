import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { appSettings } from "../../../db/schema";

export const dynamic = "force-dynamic";

const SETTING_KEY = "protectTopFour";

function adminEmails() {
  const runtimeEnv = env as unknown as { ADMIN_EMAILS?: string };
  return (runtimeEnv.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLocaleLowerCase())
    .filter(Boolean);
}

async function accessContext() {
  const user = await getChatGPTUser();
  const isAdmin = Boolean(user && adminEmails().includes(user.email.toLocaleLowerCase()));
  return { user, isAdmin };
}

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
    const [{ isAdmin }, protectTopFour] = await Promise.all([
      accessContext(),
      readProtectionSetting(),
    ]);

    return Response.json({ protectTopFour, isAdmin });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Configuration is unavailable." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { user, isAdmin } = await accessContext();
    if (!user) {
      return Response.json({ error: "Sign in is required." }, { status: 401 });
    }
    if (!isAdmin) {
      return Response.json({ error: "Only a tournament administrator can change this rule." }, { status: 403 });
    }

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
        updatedBy: user.email,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: String(payload.protectTopFour),
          updatedAt,
          updatedBy: user.email,
        },
      });

    return Response.json({ protectTopFour: payload.protectTopFour, isAdmin: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The rule could not be updated." },
      { status: 500 },
    );
  }
}
