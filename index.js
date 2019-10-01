const spongeMock = require('spongemock').spongeMock;
const express = require('express');
const app = express();
const port = process.env.PORT || 80;

app.get('/', (req, res) => {
    return res.send(spongeMock(req.query.text));
})

app.listen(port, () => console.log(`Spongemock is running on port ${port}!`));
