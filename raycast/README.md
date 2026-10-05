# my.cdn for Raycast

Search the images on your my.cdn instance from Raycast (2.4+) and copy or paste their links.

## Install

```bash
cd raycast
npm install
npm run dev
```

`npm run dev` imports the extension into Raycast. The first time you open **Search Images**, Raycast asks for the **Base URL** of your my.cdn (e.g. `https://cdn.example.com`). Change it later in Raycast Settings → Extensions → my.cdn.

## Search Images

Type to search by name, alias or tag. Results load 50 at a time as you scroll.

| Action | Shortcut |
| --- | --- |
| Copy URL | ↵ |
| Paste URL | ⌘ ↵ |
| Copy Image (the file itself) | ⌘ ⇧ C |
| Copy Markdown | ⌘ ⇧ M |
| Open in Browser | ⌘ O |
| Copy Alias URL / Open Tag Gallery | ⌘ K |
| Copy Name | ⌘ ⇧ . |

It uses the public `GET /api/images?q=` endpoint, so no sign-in is needed.
