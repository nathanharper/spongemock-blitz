const absurd = require('absurdify');
const express = require('express');
const bodyParser = require('body-parser');
const port = process.env.PORT || 80;

const app = express()
    .use(bodyParser.urlencoded({ extended: false }))
    .use(bodyParser.json());

app.get('/', (req, res) => {
    res.json(getPayload(req.query));
})

app.post('/', (req, res) => {
    res.json(getPayload(req.body));
})

app.listen(port, () => console.log(`Spongemock is running on port ${port}!`));

function getPayload({ user_id, text }) {
    let user = `<@${user_id}>`;

    if (/^<\@.+> /.test(text)) {
        const [userString, message] = text.split(' ', 2);
        user = userString;
        text = message;
    }

    return {
        "response_type": "in_channel",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": absurd(text || ''),
                    "emoji": true
                }
            },
            {
                "type": "context",
                "elements": {
                    "type": "mrkdwn",
                    "text": `Posted by ${user}`
                }
            }
        ]
    };
}
