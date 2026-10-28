/** Background entry — re-exports bridge side effects (message listeners). */

import "./bridge";
import { installVoiceHandlers } from "./voice";

installVoiceHandlers();

export { getCoreUrl, setCoreUrl, handleMessage } from "./bridge";
export { isNavMessage, navMessageForLabel } from "./navigation";
export { installVoiceHandlers } from "./voice";
