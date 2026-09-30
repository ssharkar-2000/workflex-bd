/** What the video room needs. The same for the browser and the phone version. */
export interface MeetingRoomProps {
  /** The LiveKit server to connect to (wss://…). */
  url: string;
  /** The pass into this one room. */
  token: string;
  title: string;
  /** Called when the person leaves, or the meeting ends under them. */
  onLeave: () => void;
}

/** One line of in-call chat. */
export interface ChatLine {
  id: string;
  text: string;
  ts: number;
  from: string;
  mine: boolean;
}
