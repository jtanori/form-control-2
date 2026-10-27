/** Background entry — re-exports bridge side effects (message listeners). */

import "./bridge";

export { getCoreUrl, setCoreUrl, handleMessage } from "./bridge";
export { isNavMessage, navMessageForLabel } from "./navigation";
