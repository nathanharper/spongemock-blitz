const absurd = require('absurdify');
const express = require('express');
const bodyParser = require('body-parser');
const port = process.env.PORT || 80;

const app = express()
    .use(bodyParser.urlencoded({ extended: false }))
    .use(bodyParser.json());

app.get('/', (req, res) => {
    res.send(absurd(req.query.text || ''));
})

app.post('/', (req, res) => {
    res.send(absurd(req.body.text || ''));
})

app.listen(port, () => console.log(`Spongemock is running on port ${port}!`));
