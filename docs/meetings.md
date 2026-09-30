# Meetings: scheduled video interviews

This feature belongs to `apps/api`, `apps/mobile` and `packages/shared`. Someone schedules a meeting (a video call, or an in-person session in a booked room), invites people by WorkFlex ID, and everybody invited finds it in **Menu → Meetings** with the link, Accept / Decline and a Join button.

## What runs where

| Need | Tool |
| --- | --- |
| Video, microphone, camera, screen share, live "who is in the call" | LiveKit (WebRTC) |
| Passes into a room, schedule, invitations, guest list, recurrence, rooms | `apps/api` (NestJS) + PostgreSQL |
| Invitation as a chat message, live updates on both screens | Socket.IO (the existing chat connection) |
| Chat during the call | LiveKit data messages, topic `chat` (lives only for the call) |
| Sign-in | The existing WorkFlex sign-in |

The API never handles video. It signs a short-lived LiveKit pass for one room, and only for somebody on that meeting's guest list, at the right time: the host may come in 60 minutes early, a guest 15 minutes early, and the door closes 2 hours after the end. A pass carries no admin rights.

## Setup

1. Migrate the database: `npm run db:deploy -w @workflex/api` (adds the `meetings`, `meeting_participants`, `meeting_templates` and `physical_rooms` tables; nothing existing changes).
2. Create a LiveKit project. The free tier of [LiveKit Cloud](https://cloud.livekit.io) is enough to start.
3. On the API service (Render → `workflex-bd-api` → Environment) set:

   ```dotenv
   LIVEKIT_URL=wss://<your-project>.livekit.cloud
   LIVEKIT_API_KEY=
   LIVEKIT_API_SECRET=
   WEB_APP_URL=https://workflex-bd.onrender.com
   ```

   `WEB_APP_URL` is the address of the user web app. Meeting links and the video room open there. It defaults to the first origin in `APP_WEB_ORIGINS`.
4. In the LiveKit project's **Webhooks** settings add `https://<your-api>/api/v1/meetings/livekit/webhook`, signed with the same key. This is what keeps "in the call now" and LIVE accurate when someone closes the tab instead of pressing Leave.
5. Redeploy. Until the three `LIVEKIT_*` values are set, meetings can still be scheduled and the Meetings page says video calls are not set up yet.

Local development: `docker compose up livekit` and use `LIVEKIT_URL=ws://localhost:7880`, `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret`, `WEB_APP_URL=http://localhost:8081`.

## On a phone

The video room is a web page, which every phone can open without anything extra installed. Pressing **Join now** in the phone app fetches a pass and opens the room in the phone's browser with the pass in the address after the `#`, which a browser never sends to any server; the room takes it out of the address bar as soon as it has read it. This works the same in Expo Go and in the installed app.

Browsers only allow the camera and microphone on `https://` addresses (and `localhost`), so the deployed web app must be served over https. Render does this by default.

LiveKit also has a React Native SDK. Using it would put the call inside the app itself, but it needs native modules, so it cannot run in Expo Go and needs a new development build. It is a good next step once the browser room has proved itself; `MeetingRoom.tsx` (phone) and `MeetingRoom.web.tsx` (browser) share one props contract (`room-types.ts`), so only the phone file would change.

## Not built yet

- **Push notification for an invitation (FCM).** Invitations arrive as a chat message and live on the Meetings page. A push needs a Firebase project and a device-token table.
- **Recording (LiveKit Egress), transcription and AI interview analysis.** Egress writes a room's recording to storage; the transcript and analysis would be jobs that run on that file and attach to the meeting.
- **File storage** for those recordings (S3-compatible, the same bucket settings the API already uses).

## Tests

```sh
npm run build -w @workflex/shared
npm test -w @workflex/api
```

The schedule rules (recurrence, join window, month-end clamping) and the LiveKit pass are unit tested. The end-to-end flow (two people, real LiveKit, real video) was run in two browsers with a fake camera: schedule, invitation live on the guest's screen, accept, both join, video and audio both ways, mic and camera status, chat both ways, leave, end for everyone, series cancel, room booking clash, and joining from a shared link and from a phone hand-off.
