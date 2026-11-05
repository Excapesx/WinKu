import {createContext,useContext} from 'react';
export type ArtifactState=Record<string,any>;
export const Store=createContext<{state:ArtifactState;update:(key:string,value:unknown)=>void;ask:(text:string)=>void;canAsk:boolean;flush:()=>void}>({state:{},update:()=>{},ask:()=>{},canAsk:true,flush:()=>{}});
export function useStored<T>(key:string,fallback:T):[T,(value:T)=>void] {const {state,update}=useContext(Store);return [(state[key]??fallback) as T,value=>update(key,value)];}
