/** Optional persistence: browsers can deny even access to the storage getter. */
export function safeRead(key:string):string|null {
  try{return window.localStorage.getItem(key);}catch{return null;}
}
export function safeWrite(key:string,value:string):boolean {
  try{window.localStorage.setItem(key,value);return true;}catch{return false;}
}
export function safeRemove(key:string):void {
  try{window.localStorage.removeItem(key);}catch{/* Persistence is optional. */}
}
