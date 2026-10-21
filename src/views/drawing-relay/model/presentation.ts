export const shouldFlushDraft=(deadlineMs:number,serverNow:number):boolean=>deadlineMs>serverNow&&deadlineMs-serverNow<=1500;
export function wrapTextLines(text:string,maxWidth:number,measure:(text:string)=>number):string[]{
  const lines:string[]=[];let line='';
  for(const char of text){
    if(char==='\n'){lines.push(line);line='';}
    else if(line&&measure(line+char)>maxWidth){lines.push(line);line=char;}
    else line+=char;
  }
  lines.push(line);return lines;
}
export const textBlockHeight=(lineCount:number):number=>Math.max(130,80+lineCount*30);
