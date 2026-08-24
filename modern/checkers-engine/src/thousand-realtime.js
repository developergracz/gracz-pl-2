export class ThousandRealtimeHub {
  #subscribers=new Map();

  constructor({service}){
    if(!service) throw new TypeError('Serwis Tysiąca jest wymagany dla realtime.');
    this.service=service;
  }

  async subscribe(gameId,userId,response){
    const subscription={userId,response};
    const subscribers=this.#subscribers.get(gameId)??new Set();
    subscribers.add(subscription);
    this.#subscribers.set(gameId,subscribers);

    response.writeHead(200,{
      'content-type':'text/event-stream; charset=utf-8',
      'cache-control':'no-cache, no-store',
      connection:'keep-alive',
      'x-accel-buffering':'no',
    });
    response.write(encodeEvent('thousand.snapshot',await this.service.getView(gameId,userId)));

    const keepAlive=setInterval(()=>{
      try{response.write(': keep-alive\n\n')}catch{response.end()}
    },20_000);
    keepAlive.unref?.();

    const remove=()=>{
      clearInterval(keepAlive);
      subscribers.delete(subscription);
      if(subscribers.size===0) this.#subscribers.delete(gameId);
    };
    response.on('close',remove);
    return remove;
  }

  async publish(gameId,type='thousand.updated'){
    const subscribers=[...(this.#subscribers.get(gameId)??[])];
    await Promise.allSettled(subscribers.map(async subscriber=>{
      try{
        const view=await this.service.getView(gameId,subscriber.userId);
        subscriber.response.write(encodeEvent(type,view));
      }catch{
        subscriber.response.end();
      }
    }));
  }

  close(){
    for(const subscribers of this.#subscribers.values()) for(const {response} of subscribers) response.end();
    this.#subscribers.clear();
  }
}

function encodeEvent(type,data){return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`}
