const absurd = require('absurdify');
const express = require('express');
const app = express();
const port = process.env.PORT || 80;

function responder(req, res) {
    return res.send(absurd(req.query.text));
}

app.get('/', responder);
app.post('/', responder);

app.listen(port, () => console.log(`Spongemock is running on port ${port}!`));
