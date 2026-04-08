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

/** Bot scopes for GET /slack/install → oauth/v2/authorize (comma-separated). */
const SLACK_OAUTH_BOT_SCOPES =
    process.env.SLACK_BOT_SCOPES ||
    'commands,incoming-webhook,users:read,chat:write';

const port = process.env.PORT || 80;

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/slack/install', slackOauthAuthorizeRedirect);
app.get('/slack/oauth/callback', slackOauthCallback);

app.all('/', spongemock);
app.all('/spongemock', spongemock);
app.all('/clapback', clapback);
app.all('/insult', insult);
app.all('/randomizer', randomizer);
app.all('/discord', verifyKeyMiddleware(process.env.PUBLIC_KEY), discord);

app.listen(port, () => console.log(`Spongemock is running on port ${port}!`));

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function slackOauthAuthorizeRedirect(req, res) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    if (!clientId || !redirectUri) {
        res.status(500).type('html').send(
            '<p>Configure <code>SLACK_CLIENT_ID</code> and <code>SLACK_REDIRECT_URI</code>.</p>'
        );
        return;
    }
    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', SLACK_OAUTH_BOT_SCOPES);
    url.searchParams.set('redirect_uri', redirectUri);
    res.redirect(302, url.toString());
}

async function slackOauthCallback(req, res) {
    const oauthError = req.query.error;
    if (oauthError) {
        res.status(400)
            .type('html')
            .send(`<p>OAuth error: ${escapeHtml(oauthError)}</p>`);
        return;
    }

    const code = req.query.code;
    if (!code || typeof code !== 'string') {
        res.status(400).type('html').send('<p>Missing <code>code</code>.</p>');
        return;
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
        res.status(500).type('html').send(
            '<p>Configure <code>SLACK_CLIENT_ID</code>, <code>SLACK_CLIENT_SECRET</code>, and <code>SLACK_REDIRECT_URI</code>.</p>'
        );
        return;
    }

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
    });

    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    const data = await tokenRes.json();
    if (!data.ok) {
        res.status(400)
            .type('html')
            .send(
                `<p>oauth.v2.access failed: ${escapeHtml(data.error || 'unknown')}</p>`
            );
        return;
    }

    // OAuth v2 success: bot token is access_token when token_type is "bot"
    const botToken = data.access_token;
    const teamName = data.team?.name || data.team?.id || 'workspace';
    const tokenType = data.token_type || 'bot';

    if (!botToken) {
        res.status(500).type('html').send(
            '<p>Unexpected response: no <code>access_token</code>. Check oauth.v2 payload.</p>'
        );
        return;
    }

    if (data.incoming_webhook?.url) {
        console.log('[slack oauth] incoming_webhook URL issued (store in env or secrets if you use it)');
    }

    let webhookNote = '';
    if (data.incoming_webhook?.url) {
        webhookNote = `<p>Incoming webhook URL (store securely):</p><pre>${escapeHtml(data.incoming_webhook.url)}</pre>`;
    }

    res.type('html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Slack app installed</title></head>
<body>
  <p>Installed to <strong>${escapeHtml(teamName)}</strong> (token type: ${escapeHtml(tokenType)}).</p>
  <p>Set this as <code>SLACK_BOT_TOKEN</code> for this server:</p>
  <pre>${escapeHtml(botToken)}</pre>
  ${webhookNote}
</body></html>`);
}

const clap = ':clap:';
function getData(req) {
    return req.method === 'POST' ? req.body : req.query;
}

function slackTokenMissing(res) {
    console.warn('[slack] SLACK_BOT_TOKEN is not set');
    res.status(200).end();
}

function slackNeedsChannel(res) {
    console.warn('[slack] slash command missing channel_id');
    res.status(200).end();
}

function spongemock(req, res) {
    if (!process.env.SLACK_BOT_TOKEN) {
        slackTokenMissing(res);
        return;
    }
    const data = getData(req);
    if (!data.channel_id) {
        slackNeedsChannel(res);
        return;
    }

    let { text } = data;
    text = (text || '').trim();

    //  if the text starts with @, drop that token (legacy: was used for attribution only).
    if (/^@/.test(text)) {
        const [, ...theRest] = text.split(' ');
        text = theRest.join(' ');
    }

    const blocks = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: absurd(text || ''),
            },
        },
    ];

    res.status(200).end();

    void (async () => {
        const client = new WebClient(process.env.SLACK_BOT_TOKEN);
        const post = await client.chat.postMessage({
            channel: data.channel_id,
            text: absurd(text || ''),
            blocks,
        });
        if (!post.ok) {
            throw new Error(post.error || 'chat.postMessage failed');
        }
    })().catch((err) => {
        console.error('[spongemock]', err);
    });
}

function clapback(req, res) {
    if (!process.env.SLACK_BOT_TOKEN) {
        slackTokenMissing(res);
        return;
    }
    const data = getData(req);
    if (!data.channel_id) {
        slackNeedsChannel(res);
        return;
    }

    const text = (data.text || '').trim();
    const bodyText = `${text.split(' ').join(` ${clap} `)} ${clap}`;
    const blocks = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: bodyText,
            },
        },
    ];

    res.status(200).end();

    void (async () => {
        const client = new WebClient(process.env.SLACK_BOT_TOKEN);
        const post = await client.chat.postMessage({
            channel: data.channel_id,
            text: bodyText,
            blocks,
        });
        if (!post.ok) {
            throw new Error(post.error || 'chat.postMessage failed');
        }
    })().catch((err) => {
        console.error('[clapback]', err);
    });
}

function insult(req, res) {
    if (!process.env.SLACK_BOT_TOKEN) {
        slackTokenMissing(res);
        return;
    }
    const data = getData(req);
    if (!data.channel_id) {
        slackNeedsChannel(res);
        return;
    }

    const insultText = randomInsult();
    const blocks = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: insultText,
            },
        },
    ];

    res.status(200).end();

    void (async () => {
        const client = new WebClient(process.env.SLACK_BOT_TOKEN);
        const post = await client.chat.postMessage({
            channel: data.channel_id,
            text: insultText,
            blocks,
        });
        if (!post.ok) {
            throw new Error(post.error || 'chat.postMessage failed');
        }
    })().catch((err) => {
        console.error('[insult]', err);
    });
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

function getEligibleHumanMembers(members) {
    return members.filter(
        (m) =>
            m &&
            !m.deleted &&
            !m.is_bot &&
            m.name !== 'slackbot' &&
            !m.is_stranger
    );
}

function pickTwoDistinctRandomHumanMembers(members) {
    const eligible = getEligibleHumanMembers(members);
    if (eligible.length < 2) {
        throw new Error(
            'Need at least two eligible workspace members for the randomizer.'
        );
    }
    const i = Math.floor(Math.random() * eligible.length);
    let j = Math.floor(Math.random() * eligible.length);
    while (j === i) {
        j = Math.floor(Math.random() * eligible.length);
    }
    return [eligible[i], eligible[j]];
}

async function runRandomizer(data) {
    const client = new WebClient(process.env.SLACK_BOT_TOKEN);
    const channel = data.channel_id;
    const members = await listAllWorkspaceMembers(client);
    const [a, b] = pickTwoDistinctRandomHumanMembers(members);
    const imageUrl = faker.image.urlPicsumPhotos({
        width: 800,
        height: 500,
        blur: 0,
        grayscale: false,
    });

    const mentionLine = `<@${a.id}> and <@${b.id}>`;
    const rules = `The first of you to reply *in this thread* with an accurate description of the image subject wins this round!`;

    const post = await client.chat.postMessage({
        channel,
        text: `${mentionLine}, *you've been Randomized!* :gamme_die:`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: rules,
                },
            },
            {
                type: 'image',
                image_url: imageUrl,
                alt_text: 'Random photo — guess the subject',
            },
        ],
    });

    if (!post.ok) {
        throw new Error(post.error || 'chat.postMessage failed');
    }
}

function randomizer(req, res) {
    if (!process.env.SLACK_BOT_TOKEN) {
        slackTokenMissing(res);
        return;
    }

    const data = getData(req);
    if (!data.channel_id) {
        slackNeedsChannel(res);
        return;
    }

    res.status(200).end();

    void runRandomizer(data).catch((err) => {
        console.error('[randomizer]', err);
    });
}
