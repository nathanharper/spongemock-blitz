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
    return {
        response_type: 'in_channel',
        text: `${user_id} says: ` + absurd(text || '')
    };
}
