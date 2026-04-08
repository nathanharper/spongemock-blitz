const absurd = require('absurdify');
const express = require('express');
const bodyParser = require('body-parser');
const { WebClient } = require('@slack/web-api');
const { faker } = require('@faker-js/faker');
const randomInsult = require('./cusser.js');
const discord = require('./discord');
const {verifyKeyMiddleware} = require('discord-interactions');

const dotenv = require('dotenv');
dotenv.config();

const RANDOMIZER_DEFAULT_CHANNEL =
    process.env.RANDOMIZER_DEFAULT_CHANNEL || 'tvtalk';

const port = process.env.PORT || 80;

const app = express()

    // setup
    .use(bodyParser.urlencoded({ extended: false }))
    .use(bodyParser.json())
    .use(express.static('public'))

    // route
    .all('/', spongemock)
    .all('/spongemock', spongemock)
    .all('/clapback', clapback)
    .all('/insult', insult)
    .all('/randomizer', randomizer)
    .all('/discord', verifyKeyMiddleware(process.env.PUBLIC_KEY), discord)

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
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": absurd(text || ''),
                },
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
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `${text.split(' ').join(` ${clap} `)} ${clap}`,
                },
            },
        ]
    });
}

function insult(req, res) {
    res.json({
        "response_type": "in_channel",
        "replace_original": true,
        "delete_original": true,
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": randomInsult(),
                },
            },
        ]
    });
}

function parseRandomizerChannel(text) {
    const raw = (text || '').trim();
    if (!raw) {
        return RANDOMIZER_DEFAULT_CHANNEL;
    }
    const link = raw.match(/^<#(C[A-Z0-9]+)(?:\|[^>]+)?>/);
    if (link) {
        return link[1];
    }
    const token = raw.split(/\s+/)[0];
    return token.replace(/^#/, '');
}

async function listAllWorkspaceMembers(client) {
    const members = [];
    let cursor;
    do {
        const page = await client.users.list({ limit: 200, cursor });
        if (!page.ok) {
            throw new Error(page.error || 'users.list failed');
        }
        members.push(...(page.members || []));
        cursor = page.response_metadata?.next_cursor;
    } while (cursor);
    return members;
}

function pickRandomHumanMember(members) {
    const eligible = members.filter(
        (m) =>
            m &&
            !m.deleted &&
            !m.is_bot &&
            m.name !== 'slackbot' &&
            !m.is_stranger
    );
    if (!eligible.length) {
        throw new Error('No eligible workspace members found.');
    }
    return eligible[Math.floor(Math.random() * eligible.length)];
}

async function postRandomizerError(responseUrl, message) {
    if (!responseUrl) {
        return;
    }
    try {
        await fetch(responseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                response_type: 'ephemeral',
                text: `Randomizer failed: ${message}`,
            }),
        });
    } catch (_) {
        /* ignore */
    }
}

async function runRandomizer(data) {
    const client = new WebClient(process.env.SLACK_BOT_TOKEN);
    const channel = parseRandomizerChannel(data.text);
    const members = await listAllWorkspaceMembers(client);
    const chosen = pickRandomHumanMember(members);
    const imageUrl = faker.image.urlPicsumPhotos({
        width: 800,
        height: 500,
        blur: 0,
        grayscale: false,
    });

    const post = await client.chat.postMessage({
        channel,
        text: `<@${chosen.id}> you've been randomized!`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `<@${chosen.id}> *You've been randomized!* :game_die: Identify this image as fast as you can!`,
                },
            },
            {
                type: 'image',
                image_url: imageUrl,
                alt_text: 'Random photo (Picsum Photos)',
            },
        ],
    });

    if (!post.ok) {
        throw new Error(post.error || 'chat.postMessage failed');
    }
}

function randomizer(req, res) {
    if (!process.env.SLACK_BOT_TOKEN) {
        res.json({
            response_type: 'ephemeral',
            text: 'Slack bot token missing. Set SLACK_BOT_TOKEN in the environment.',
        });
        return;
    }

    const data = getData(req);
    res.json({
        response_type: 'ephemeral',
        text: 'Picking someone and posting to the channel…',
    });

    void runRandomizer(data).catch((err) => {
        console.error('[randomizer]', err);
        void postRandomizerError(data.response_url, err.message || String(err));
    });
}
