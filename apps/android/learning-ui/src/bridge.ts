import type {BridgeEvent} from './types';
export const native = () => Boolean(window.DshLearning);
export function send(event:BridgeEvent) {window.DshLearning?.postMessage(JSON.stringify(event));}
