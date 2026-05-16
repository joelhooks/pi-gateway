import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createMemoryState } from "@chat-adapter/state-memory";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handlePiGatewayMessage, pollPiGatewayNotifications } from "./pi-gateway-router.mjs";
import { gatewayHome, ownerChatIdFromHome, telegramNotificationIntervalMsFromHome, telegramTokenFromHome, telegramUserNameFromHome } from "../dist/src/relay/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stateDir = process.env.PI_GATEWAY_TELEGRAM_STATE_DIR || gatewayHome();
const ownerChatFile = process.env.PI_GATEWAY_TELEGRAM_OWNER_CHAT_FILE || join(stateDir, "owner-chat-id");
const lastStartFile = join(stateDir, "last-start");

mkdirSync(stateDir, { recursive: true });

const token = telegramTokenFromHome();
if (token && !process.env.TELEGRAM_BOT_TOKEN) process.env.TELEGRAM_BOT_TOKEN = token;

function normalizeTelegramThreadId(id) {
  if (!id) return id;
  return id.startsWith("telegram:") ? id : `telegram:${id}`;
}

const configuredOwnerChatId = normalizeTelegramThreadId(ownerChatIdFromHome());
if (configuredOwnerChatId && !existsSync(ownerChatFile)) writeFileSync(ownerChatFile, configuredOwnerChatId);

const telegram = createTelegramAdapter({ mode: "polling" });
const bot = new Chat({
  userName: telegramUserNameFromHome(),
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
  const chatId = normalizeTelegramThreadId(readFileSync(ownerChatFile, "utf8").trim());
  return chatId ? bot.channel(chatId) : undefined;
}

async function handleMessage(thread, message) {
  const text = message.text?.trim();
  if (!text) return;

  if (!existsSync(ownerChatFile)) writeFileSync(ownerChatFile, normalizeTelegramThreadId(thread.id));
  console.log(`[${thread.id}] ← ${text.slice(0, 120)}`);

  try {
    const routed = await handlePiGatewayMessage(text, thread.id);
    if (routed) {
      console.log(`[${thread.id}] gateway → ${routed.slice(0, 120)}`);
      await thread.post({ markdown: routed });
      return;
    }

    await thread.post("🐀 I’m ShitRat, the pi-gateway control plane. Try `messages`, `status`, or `/gateway help`.");
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
}, telegramNotificationIntervalMsFromHome());

await bot.initialize();

if (checkRestart()) {
  setTimeout(async () => {
    const channel = await ownerChannel();
    await channel?.post("🐀 pi-gateway Telegram relay restarted.");
  }, 5000);
}

setTimeout(() => gatewayNotificationTick().catch(() => undefined), 10000);
console.log("pi-gateway Telegram relay listening");
