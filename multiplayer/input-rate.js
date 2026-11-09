// Keep rapid changes of direction and key releases responsive while
// suppressing redundant input packets sent inside a short time window.
export function createInputGate(minDuplicateIntervalMs=20){
  let lastSignature=null,lastAt=-Infinity;
  return (signature,now)=>{
    if(signature===lastSignature&&now-lastAt<minDuplicateIntervalMs)return false;
    lastSignature=signature;
    lastAt=now;
    return true;
  };
}
