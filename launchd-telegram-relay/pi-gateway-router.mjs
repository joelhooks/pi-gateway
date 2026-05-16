import { createTelegramRouter } from "../dist/src/relay/telegram-router.js";
import { routerConfigFromHome } from "../dist/src/relay/config.js";

const router = createTelegramRouter(routerConfigFromHome());

export const handlePiGatewayMessage = router.handle;
export const pollPiGatewayNotifications = router.pollNotifications;
