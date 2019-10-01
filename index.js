const absurd = require('absurdify');
const express = require('express');
const bodyParser = require('body-parser');
const port = process.env.PORT || 80;

const app = express()
    .use(bodyParser.urlencoded({ extended: false }))
    .use(bodyParser.json())
    .use(express.static('public'));

app.get('/', (req, res) => {
    res.json(getPayload(req.query));
})

app.post('/', (req, res) => {
    res.json(getPayload(req.body));
})

app.listen(port, () => console.log(`Spongemock is running on port ${port}!`));

function getPayload({ user_id, text }) {
    text = text.trim();
    let user = `<@${user_id}>`;

    if (/^<\@.+> /.test(text)) {
        const [userString, message] = text.split(' ', 2);
        user = userString;
        text = message;
    }

    return {
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
    };
}
