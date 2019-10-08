const absurd = require('absurdify');
const express = require('express');
const bodyParser = require('body-parser');
const port = process.env.PORT || 80;

const app = express()

    // setup
    .use(bodyParser.urlencoded({ extended: false }))
    .use(bodyParser.json())
    .use(express.static('public'))

    // route
    .all('/', spongemock)
    .all('/clapback', clapback)

    // listen
    .listen(port, () => console.log(`Spongemock is running on port ${port}!`));

const clap = ':clap:';
function getData(req) {
    return req.method === 'POST' ? req.body : req.query;
}

function spongemock(req, res) {
    let { user_id, text } = getData(req);
    text = (text || '').trim();
    let user = `<@${user_id}>`;

    //  if the text starts with ampersand, use that value as the quoted user to display.
    if (/^@/.test(text)) {
        const [userString, ...theRest] = text.split(' ');
        user = userString;
        text = theRest.join(' ');
    }

    res.json({
        "response_type": "in_channel",
        "replace_original": true,
        "delete_original": true,
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": absurd(text || ''),
                },
                "accessory": {
                    "type": "image",
                    "image_url": "https://spongemock-blitz.herokuapp.com/spongeo.jpg",
                    "alt_text": "Spongebob"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": `Posted by ${user}`
                    }
                ]
            }
        ]
    });
}

function clapback(req, res) {
    const text = (getData(req).text || '').trim();

    res.json({
        "response_type": "in_channel",
        "replace_original": true,
        "delete_original": true,
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `${clap} ${text.split(' ').join(` ${clap} `)} ${clap}`,
                },
            },
        ]
    });
}
