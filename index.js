const spongeMock = require('spongemock').spongeMock;
const express = require('express');
const app = express();
const port = process.env.NODE_ENV == 'development' ? 3000 : 80;

app.get('/', (req, res) => {
    return res.send(spongeMock(req.query.text));
})

app.listen(port, () => console.log('Spongemock is running!'));
