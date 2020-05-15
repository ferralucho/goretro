import { Mood, RoomState } from './types';

const CLIENT_ID_LEN = 16;
const SECRET_LEN = 64;

type ConnectionStateChangeCallback = (connected: boolean) => void;

type Message = {name: string} & Record<string, any>
type MessageCallback = (message: Message) => void;

export class Connection {
  baseUrl: string
  clientId: string
  secret: string

  connectionStateChangeListeners: ConnectionStateChangeCallback[] = [];
  messageListeners: MessageCallback[] = [];

  connected = false // EventSource

  constructor(baseUrl: string, clientId: string, secret: string) {
    this.baseUrl = baseUrl;
    this.clientId = clientId;
    this.secret = secret;
  }

  async start(): Promise<void> {
    if (this.connected) {
      return;
    }

    const res = await rawCommand<HelloResponse>(this.baseUrl, {name: 'hello', clientId: this.clientId, secret: this.secret})

    // console.log('Connection up, events URL: ' + res.eventsUrl)

    const eventSource = new EventSource(res.eventsUrl);
    eventSource.onerror = (err) => {
      console.error('Event source error', err);
    }
    // maybe useless (just for logging)
    eventSource.onopen = () => {
      // Lost connection but can ignore
      // console.log('Event source connected');
      this.connected = true;
      this.connectionStateChangeListeners.forEach(x => x(true));
    }

    eventSource.onmessage = (evt) => {
      // console.log("Event received")
      // console.log(evt)

      const parsed = JSON.parse(evt.data);

      if (parsed.event === 'keep-alive') {
        return;
      }

      this.messageListeners.forEach(x => x(parsed));
    }
  }

  onConnectionStateChange(callback: (connected: boolean) => void) {
    this.connectionStateChangeListeners.push(callback);
  }

  onMessage(callback: (msg: Message) => void) {
    this.messageListeners.push(callback);
  }

  // API

  async identify(nickname: string): Promise<void> {
    return this.dataCommand({name: 'identify', nickname: nickname})
  }

  async createRoom() {
     // TODO(abustany): What do we do for the room name?
    return this.dataCommand({name: 'create-room', roomName: "name"})
  }

  async joinRoom(roomId: string) {
    return this.dataCommand({name: 'join-room', roomId: roomId})
  }

  async setRoomState(state: RoomState) {
    return this.dataCommand({name: 'set-state', state: state})
  }

  async saveNote(noteId: number, text: string, mood: Mood) {
    return this.dataCommand({name: 'save-note', noteId, text, mood})
  }

  // END OF API

  async dataCommand<T>(payload: unknown): Promise<T> {
    if (!this.connected) {
      throw Error('Cannot send data command on disconnected connection');
    }

    return rawCommand(this.baseUrl, {name: 'data', clientId: this.clientId, secret: this.secret, payload: payload})
  }
}

function randomID(length: number) {
  const data = new Uint8Array(length);
  window.crypto.getRandomValues(data);
  return btoa(String.fromCharCode.apply(null, data as unknown as number[])).replace(/\+/g, '-').replace(/\//g, '_');
}

export function generateClientId(): string {
  // TODO: Extract
  const lsKey = "clientid"
  let clid = localStorage.getItem(lsKey)
  if (clid) return clid
  clid = randomID(CLIENT_ID_LEN)
  localStorage.setItem(lsKey, clid)
  return clid;
}

export function generateSecret(): string {
  // TODO: Extract
  const lsKey = "secret"
  let clid = localStorage.getItem(lsKey)
  if (clid) return clid
  clid = randomID(SECRET_LEN)
  localStorage.setItem(lsKey, clid)
  return clid;
}

async function rawCommand<T>(baseUrl: string, command: unknown): Promise<T> {
  return fetch(`${baseUrl}/command`, {
    method: 'POST',
    mode: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  }).then(res => {
    if (res.status !== 200) {
      throw new Error('Unexpected status code: ' + res.status);
    }

    return res.json()
  }).catch(e => {
    console.error('API command error: ', e);
    throw e;
  });
}

interface HelloResponse {
  eventsUrl: string;
}
