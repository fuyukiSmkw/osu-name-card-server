# osu-name-card-server

Generate your osu! name card! Now only in simplified Chinese 目前只有简体中文

## License

GPLv3 or later

## Configuration

Set environmental variables: (You can create a file `.env` if it is local)
1. `CLIENT_ID`, `CLIENT_SECRET`: your client ID and secret.  See your [osu settings](https://osu.ppy.sh/home/account/edit)
2. `HOSTNAME`: eg. `https://osu-name-card-server.vercel.app` (no need for local) (**SHOULD NOT END WITH A "/" !!!!!!** otherwise the images will be 403 forbidden)

## Run

```bash
npm i
npm run start
```

## Thanks

* [osu!](https://osu.ppy.sh)
* [osu-api-v2-js](https://github.com/TTTaevas/osu-api-v2-js/)
* [cors-anywhere](https://github.com/Rob--W/cors-anywhere)
* [dom-to-image](https://github.com/tsayen/dom-to-image)
