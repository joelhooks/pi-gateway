import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createMemoryState } from "@chat-adapter/state-memory";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handlePiGatewayMessage, pollPiGatewayNotifications } from "./pi-gateway-router.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stateDir = process.env.PI_GATEWAY_TELEGRAM_STATE_DIR || join(process.env.HOME || __dirname, ".pi", "gateway-telegram-relay");
const ownerChatFile = process.env.PI_GATEWAY_TELEGRAM_OWNER_CHAT_FILE || join(stateDir, "owner-chat-id");
const lastStartFile = join(stateDir, "last-start");

mkdirSync(stateDir, { recursive: true });

const telegram = createTelegramAdapter({ mode: "polling" });
const bot = new Chat({
  userName: process.env.PI_GATEWAY_TELEGRAM_USER_NAME || "pi-gateway",
  adapters: { telegram },
  state: createMemoryState(),
  onLockConflict: "force",
});

function checkRestart() {
  const isRestart = existsSync(lastStartFile);
  writeFileSync(lastStartFile, String(Date.now()));
  return isRestart;
}

async function ownerChannel() {
  if (!existsSync(ownerChatFile)) return undefined;
  const chatId = readFileSync(ownerChatFile, "utf8").trim();
  return chatId ? bot.channel(chatId) : undefined;
}

async function handleMessage(thread, message) {
  const text = message.text?.trim();
  if (!text) return;

  if (!existsSync(ownerChatFile)) writeFileSync(ownerChatFile, thread.id);
  console.log(`[${thread.id}] ← ${text.slice(0, 120)}`);

  try {
    const routed = await handlePiGatewayMessage(text, thread.id);
    if (routed) {
      console.log(`[${thread.id}] gateway → ${routed.slice(0, 120)}`);
      await thread.post({ markdown: routed });
      return;
    }

    await thread.post("🐀 pi-gateway relay only. Try /gateway help");
  } catch (error) {
    console.error(`[${thread.id}] error:`, error.message?.slice(0, 240));
    try { await thread.post("Gateway relay blew up. Check launchd logs."); } catch {}
  }
}

bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await handleMessage(thread, message);
});

bot.onSubscribedMessage(async (thread, message) => {
  await handleMessage(thread, message);
});

async function gatewayNotificationTick() {
  const channel = await ownerChannel();
  if (!channel) return;
  await pollPiGatewayNotifications(channel);
}

setInterval(() => {
  gatewayNotificationTick().catch((error) => console.error("[gateway] notification tick failed:", error.message?.slice(0, 240)));
}, Number(process.env.PI_GATEWAY_TELEGRAM_NOTIFICATION_INTERVAL_MS || 60_000));

await bot.initialize();

if (checkRestart()) {
  setTimeout(async () => {
    const channel = await ownerChannel();
    await channel?.post("🐀 pi-gateway Telegram relay restarted.");
  }, 5000);
}

setTimeout(() => gatewayNotificationTick().catch(() => undefined), 10000);
console.log("pi-gateway Telegram relay listening");
