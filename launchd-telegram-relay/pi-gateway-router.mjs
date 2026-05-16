import { createTelegramRouter } from "../dist/src/relay/telegram-router.js";

const DEFAULT_ROOTS = {
  aihero: "/Users/joel/Code/badass-courses/aihero-support",
};

const router = createTelegramRouter({
  defaultProjectId: process.env.PI_GATEWAY_DEFAULT_PROJECT || "aihero",
  stateFile: process.env.PI_GATEWAY_TELEGRAM_STATE || "/Users/joel/.pi/gateway-telegram-router.json",
  projects: Object.entries(DEFAULT_ROOTS).map(([id, root]) => ({
    id,
    root,
    aliases: id === "aihero" ? ["ai-hero"] : [],
  })),
});

export const handlePiGatewayMessage = router.handle;
export const pollPiGatewayNotifications = router.pollNotifications;
