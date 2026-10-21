import {spawnSync} from 'node:child_process';
const files=['drawing-relay','drawing-relay-transport','drawing-relay-canvas','drawing-relay-fixes','drawing-relay-storage','drawing-relay-browser-storage'];
for(const file of files){
  const result=spawnSync(process.execPath,[`tests/${file}.test.mjs`],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
