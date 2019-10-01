const absurd = require('absurdify');
const express = require('express');
const app = express();
const port = process.env.PORT || 80;

app.get('/', (req, res) => {
    res.send(absurd(req.query.text));
})

app.post('/', (req, res) => {
    res.send(absurd(req.body.text));
})

app.listen(port, () => console.log(`Spongemock is running on port ${port}!`));
