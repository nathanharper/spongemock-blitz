const absurd = require('absurdify');
const express = require('express');
const bodyParser = require('body-parser');
const port = process.env.PORT || 80;

const app = express()
    .use(bodyParser.urlencoded({ extended: false }))
    .use(bodyParser.json());

app.get('/', (req, res) => {
    res.send(spongemock(req.query));
})

app.post('/', (req, res) => {
    res.send(spongemock(req.body));
})

app.listen(port, () => console.log(`Spongemock is running on port ${port}!`));

function spongemock({ user_id, text }) {
    return `${user_id} says: ` + absurd(text || '');
}
